import { SessionManager } from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { excludeTracker } from "./tracker-worktree";
import { declaresSetup, pendingSetup, writeSetup } from "./setup";
import { resolve } from "node:path";
import { getThread, saveThread, threadForSession } from "./registry";
import { checkout, git } from "./git";
import { validateLaunch } from "./launch";
import { command } from "./process";
import { persistHeader } from "./sessions";
import { assertBb, bbThreads, bbWorkerThread, logBb, openBb, spawnBb, tellBb } from "./bb";
import type { NewThreadOptions, ThreadRecord } from "./types";

async function activeThread(id: string): Promise<ThreadRecord> {
	const thread = await getThread(id);
	if (!thread || thread.archived) throw new Error("No active thread: " + id);
	return thread;
}

async function spawnParent(options: NewThreadOptions): Promise<string | undefined> {
	if (options.parent !== undefined) return (await activeThread(options.parent)).id;
	const session = options.parentSession ?? process.env.PI_SESSION_ID;
	const parent = session && await threadForSession(session);
	return parent && !parent.archived ? parent.id : undefined;
}

/** The bb thread a new bb thread sits under: its registry parent's, else the bb session spawning it. */
async function bbParent(parent: string | undefined): Promise<string | undefined> {
	const record = parent ? await getThread(parent) : undefined;
	return record?.bb ?? process.env.BB_THREAD_ID;
}

async function setup(cwd: string): Promise<void> {
	if (await declaresSetup(cwd)) await command("mise", ["run", "setup"], cwd);
}

export async function newThread(options: NewThreadOptions = {}): Promise<ThreadRecord> {
	if (options.in !== undefined && options.worktree !== undefined) throw new Error("Supply in or worktree, not both");
	if (options.in !== undefined && options.base !== undefined) throw new Error("base only applies to a new worktree");
	validateLaunch(options.launch);
	await assertBb();
	const spawning = checkout(resolve(options.cwd ?? process.cwd()));
	const parent = await spawnParent(options);
	const id = randomUUID();
	const name = options.worktree ?? options.worker?.handle ?? id;
	let location: ReturnType<typeof checkout>;
	const owning = options.in === undefined;
	let owned = false;
	if (options.in !== undefined) location = checkout(resolve(spawning.cwd, options.in));
	else {
		if (!spawning.branch) throw new Error("A new owning worktree needs a spawning checkout branch: " + spawning.cwd);
		git(spawning.cwd, "check-ref-format", "--branch", name);
		const path = resolve(spawning.project + "__worktrees", name);
		if (existsSync(path)) throw new Error("Worktree path already exists (not owned): " + path);
		if (git(spawning.cwd, "branch", "--list", name)) throw new Error("Worktree branch already exists (not owned): " + name);
		location = { cwd: path, project: spawning.project, worktree: path, branch: name };
	}
	const project = owning ? spawning.project : location.project;
	const inProject = (path: string) => { try { return checkout(path).project === project; } catch { return false; } };
	if (options.worker && bbWorkerThread(await bbThreads(), options.worker.handle, options.worker.run, inProject))
		throw new Error("Active worker already exists: " + options.worker.run + "/" + options.worker.handle);
	let thread: ThreadRecord | undefined;
	let file: string | undefined;
	try {
		const manager = SessionManager.create(location.cwd, undefined, { id });
		file = manager.getSessionFile()!;
		await persistHeader(file, id, location.cwd);
		thread = {
			id, sessionId: manager.getSessionId(), sessionFile: file, ...location,
			ownership: owning ? "owner" : "guest", parent, archived: false, created: new Date().toISOString(),
			worker: options.worker, launch: options.launch,
		};
		await saveThread(thread);
		if (owning) {
			// Own the attempt: git can create a branch/path and then fail during checkout.
			owned = true;
			git(spawning.cwd, "worktree", "add", ...(options.worker ? ["--no-checkout"] : []), "-b", name, location.cwd, options.base ?? "HEAD");
			if (options.worker) excludeTracker(location.cwd);
			location = checkout(location.cwd);
			thread = { ...thread, ...location };
			await saveThread(thread);
			git(location.cwd, "config", "branch." + location.branch + ".ab-parent", spawning.branch!);
		}
		await options.prepare?.(thread);
		if (options.prepare) await saveThread(thread);
		if (owning) {
			// Workers and interactive threads set up just before bb starts pi.
			if (options.interactive || options.worker) writeSetup(id, { state: "pending" });
			else await setup(location.cwd);
		}
		await pendingSetup(thread);
		thread = { ...thread, bb: await spawnBb(thread, await bbParent(parent)) };
		await saveThread(thread);
		return thread;
	} catch (error) {
		const cleanup: string[] = [];
		// Failed setup/launch owns its partial path until cleanup succeeds.
		if (owned && !cleanup.length) {
			try {
				const registered = git(spawning.cwd, "worktree", "list", "--porcelain", "-z").split("\0").includes("worktree " + location.cwd);
				if (registered) git(spawning.cwd, "worktree", "remove", "--force", location.cwd);
				else await rm(location.cwd, { recursive: true, force: true });
				if (git(spawning.cwd, "branch", "--list", name)) git(spawning.cwd, "branch", "-D", name);
			} catch (e) { cleanup.push(String(e)); }
		}
		if (thread && !cleanup.length) await saveThread({ ...thread, archived: true });
		if (file && !cleanup.length) await rm(file, { force: true });
		throw new Error("Thread " + id + " at " + location.cwd + " failed: " + String(error) + (cleanup.length ? "\nPartial resources remain registered: " + cleanup.join("\n") : "\nPartial resources cleaned"));
	}
}

/** Opens the thread in bb. */
export async function attachThread(id: string): Promise<void> {
	await openBb(await bbOf(id));
}

/** The bb thread id of a registered thread; one registered under the retired zmx runtime has none. */
async function bbOf(id: string, archived = false): Promise<string> {
	const thread = archived ? await getThread(id) : await activeThread(id);
	if (!thread) throw new Error("Unknown thread: " + id);
	if (!thread.bb) throw new Error("Thread " + id + " was registered under the retired zmx runtime and has no bb thread; abandon it (ab thread abandon " + id + ")");
	return thread.bb;
}

export async function sendThread(id: string, text: string): Promise<void> {
	await tellBb(await bbOf(id), text, "queue");
}

export async function historyThread(id: string, lines?: number): Promise<string> {
	if (lines !== undefined && (!Number.isInteger(lines) || lines < 0)) throw new Error("lines must be a nonnegative integer");
	const history = await logBb(await bbOf(id, true));
	if (lines === undefined) return history;
	const split = history.replace(/\n$/, "").split("\n");
	return lines === 0 ? "" : split.slice(-lines).join("\n") + (history.endsWith("\n") ? "\n" : "");
}
