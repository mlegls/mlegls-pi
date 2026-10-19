import { SessionManager } from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { excludeTracker } from "./tracker-worktree";
import { declaresSetup, pendingSetup, writeSetup } from "./setup";
import { workerResources } from "./resources";
import { resolve } from "node:path";
import { readLive, type Live } from "../session-meta/live";
import { allThreads, getThread, saveThread, threadForSession, workerThread } from "./registry";
import { checkout, git } from "./git";
import { validateLaunch } from "./launch";
import { command } from "./process";
import { persistHeader } from "./sessions";
import { assertBb, bbThreads, logBb, openBb, spawnBb, tellBb, type BbThread } from "./bb";
import type { NewThreadOptions, ThreadRecord, ThreadRow, ThreadSnapshot } from "./types";

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
	if (options.worker && await workerThread(options.worker.handle, owning ? spawning.cwd : location.cwd, options.worker.run))
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
			worker: options.worker, launch: options.launch, ...(options.interactive ? { interactive: true } : {}),
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

/** Records from before the field: workers and agent-spawned children are not interactive. */
export function isInteractive(thread: ThreadRecord): boolean {
	return thread.interactive ?? (!thread.worker && !thread.parent);
}

/** A frontend showed the thread: its current turn end is read. */
export async function seeThread(id: string): Promise<void> {
	await saveThread({ ...await activeThread(id), seenAt: new Date().toISOString() });
}

function mergeParent(thread: ThreadRecord): string | undefined {
	if (!thread.branch || thread.ownership !== "owner") return;
	try { return git(thread.project, "config", "--get", "branch." + thread.branch + ".ab-parent") || undefined; }
	catch (error) { if ((error as { status?: number }).status !== 1) throw error; }
}

const defaults = new Map<string, string | undefined>();
/** The remote's default branch (origin/HEAD), else a local main/master. */
function defaultBranch(project: string): string | undefined {
	if (defaults.has(project)) return defaults.get(project);
	let ref: string | undefined;
	for (const args of [["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], ["rev-parse", "--abbrev-ref", "main"], ["rev-parse", "--abbrev-ref", "master"]]) {
		try { ref = git(project, ...args) || undefined; } catch {}
		if (ref) break;
	}
	defaults.set(project, ref);
	return ref;
}

/** A top-level thread (no parent, or merging into the default branch's local copy) measures against the default branch: the remote's ("origin", unpushed work) or its local copy ("local", unmerged work). */
function deltaBase(project: string, parent: string | undefined, mode: "origin" | "local"): string | undefined {
	const base = defaultBranch(project), local = base?.replace(/^origin\//, "");
	if (parent && parent !== local) return parent;
	return (mode === "local" ? local : base) ?? parent;
}

function delta(thread: ThreadRecord, parent: string | undefined): ThreadSnapshot["delta"] {
	const dir = thread.worktree ?? thread.cwd;
	if (!parent || !existsSync(dir)) return;
	try {
		const [behind, ahead] = git(dir, "rev-list", "--left-right", "--count", parent + "...HEAD").split(/\s+/).map(Number);
		const stat = git(dir, "diff", "--shortstat", git(dir, "merge-base", parent, "HEAD"));
		const n = (re: RegExp) => Number(re.exec(stat)?.[1] ?? 0);
		return { against: parent, files: n(/(\d+) files? changed/), added: n(/(\d+) insertion/), removed: n(/(\d+) deletion/), ahead, behind };
	} catch { return; }
}

/** bb's view of the bb-run threads among records; none fetched when no record is bb-run. */
async function bbView(records: ThreadRecord[]): Promise<Map<string, BbThread>> {
	return records.some(t => t.bb) ? bbThreads() : new Map();
}

function snapshot(thread: ThreadRecord, records: ThreadRecord[], live: Live[], mode: "origin" | "local" = "origin", bb = new Map<string, BbThread>()): ThreadSnapshot {
	const canonical = live.filter(l => l.sessionId === thread.sessionId && (!l.sessionFile || l.sessionFile === thread.sessionFile));
	if (canonical.length > 1) throw new Error("Concurrent canonical pi writers for thread " + thread.id);
	const pi = canonical[0];
	const parent = mergeParent(thread);
	const parentThread = parent ? records.find(t => t.project === thread.project && t.ownership === "owner" && t.branch === parent) : undefined;
	// A bb-run thread's state is bb's: bb may release an idle thread's pi, which doesn't end the thread.
	const inBb = thread.bb ? bb.get(thread.bb) : undefined;
	const bbState = !inBb || inBb.archivedAt ? "exited" : inBb.status === "idle" || inBb.status === "error" ? "idle" : "working";
	const state = thread.bb ? bbState : pi?.state ?? "exited"; // no bb id: a thread registered under the retired zmx runtime, live only while its pi is
	const idleSince = pi?.state === "idle" ? pi.since : undefined;
	const attention: ThreadSnapshot["attention"] = thread.blocked || inBb?.status === "error" ? "needs-you"
		: state === "working" ? "running"
		: idleSince && thread.seenAt && idleSince > thread.seenAt ? "unread" : "read";
	return {
		thread, state, pid: pi?.pid, ...(inBb && { bbStatus: inBb.status }), interactive: isInteractive(thread), attention, idleSince,
		mergeParent: parent, mergeParentThread: parentThread?.id, delta: delta(thread, deltaBase(thread.project, parent, mode)),
		terminals: thread.bb && bbState !== "exited" ? [{ name: thread.id + ".agent", role: "agent" }] : [],
	};
}

export async function threadSnapshot(id: string): Promise<ThreadSnapshot> {
	const thread = await getThread(id);
	if (!thread) throw new Error("Unknown thread: " + id);
	return { ...snapshot(thread, await allThreads(), readLive(), "origin", await bbView([thread])), workspace: (await workerResources([thread])).get(thread.id) };
}

/** Active threads, globally unless cwd scopes a git project. */
export async function listThreads(options: { tree?: "spawn" | "merge"; cwd?: string; delta?: "origin" | "local" } = {}): Promise<ThreadRow[]> {
	const project = options.cwd === undefined ? undefined : checkout(options.cwd).project;
	const records = (await allThreads()).filter(t => project === undefined || t.project === project);
	const [resources, bb] = await Promise.all([workerResources(records), bbView(records)]), live = readLive();
	const rows = records.map(t => {
		const snap = snapshot(t, records, live, options.delta, bb);
		return { ...snap, workspace: resources.get(t.id), depth: 0, treeParent: options.tree === "merge" ? snap.mergeParentThread : t.parent };
	});
	const byId = new Map(rows.map(r => [r.thread.id, r]));
	for (const row of rows) if (!row.treeParent || !byId.has(row.treeParent) || row.treeParent === row.thread.id) row.treeParent = undefined;
	const ordered: ThreadRow[] = [], seen = new Set<string>();
	const visit = (row: ThreadRow, depth: number) => {
		if (seen.has(row.thread.id)) return;
		seen.add(row.thread.id);
		row.depth = depth;
		ordered.push(row);
		for (const child of rows) if (child.treeParent === row.thread.id) visit(child, depth + 1);
	};
	for (const root of rows) if (!root.treeParent) visit(root, 0);
	// A malformed/reparented cycle is still visible, never silently drops active threads.
	for (const row of rows) if (!seen.has(row.thread.id)) { row.treeParent = undefined; visit(row, 0); }
	// A worker that needs you raises its interactive spawn ancestor.
	const byThread = new Map(rows.map(r => [r.thread.id, r]));
	for (const row of rows) {
		if (row.interactive || row.attention !== "needs-you") continue;
		let up = row.thread.parent, hops = 0;
		while (up && hops++ < 64) {
			const ancestor = byThread.get(up);
			if (!ancestor) break;
			if (ancestor.interactive) { ancestor.attention = "needs-you"; break; }
			up = ancestor.thread.parent;
		}
	}
	return ordered;
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
