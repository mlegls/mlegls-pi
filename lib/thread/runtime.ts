import { SessionManager } from "@earendil-works/pi-coding-agent";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { read } from "../board/store";
import { readLive, type Live } from "../session-meta/live";
import { allThreads, getThread, saveThread, threadForSession, workerThread } from "./registry";
import { checkout, git } from "./git";
import { isPiLaunch, launchEnv, validateLaunch } from "./launch";
import { command, executable } from "./process";
import { sessionFile, sessionHeader, persistHeader } from "./sessions";
import { terminals, terminalLock, zmx, zmxBinary, type ZmxTerminal } from "./zmx";
import type { NewThreadOptions, ThreadRecord, ThreadRow, ThreadSnapshot, ThreadTerminal } from "./types";

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

async function setup(cwd: string): Promise<void> {
	let declared: boolean;
	try { declared = (JSON.parse(await command("mise", ["tasks", "ls", "--json"], cwd)) as { name: string }[]).some(t => t.name === "setup"); }
	catch { return; } // Same task discovery boundary as reconcile/checks.ts declaredGate.
	if (declared) await command("mise", ["run", "setup"], cwd);
}

export async function newThread(options: NewThreadOptions = {}): Promise<ThreadRecord> {
	if (options.in !== undefined && options.worktree !== undefined) throw new Error("Supply in or worktree, not both");
	if (options.in !== undefined && options.base !== undefined) throw new Error("base only applies to a new worktree");
	validateLaunch(options.launch);
	const spawning = checkout(resolve(options.cwd ?? process.cwd()));
	const parent = await spawnParent(options);
	const source = options.forkFrom && await sessionFile(options.forkFrom, spawning.cwd);
	const id = randomUUID();
	const name = options.worktree ?? options.worker?.handle ?? id;
	let location: ReturnType<typeof checkout>;
	const owning = options.in === undefined;
	let owned = false;
	let launchAttempted = false;
	if (options.in !== undefined) location = checkout(resolve(spawning.cwd, options.in));
	else {
		if (!spawning.branch) throw new Error("A new owning worktree needs a spawning checkout branch: " + spawning.cwd);
		git(spawning.cwd, "check-ref-format", "--branch", name);
		const path = resolve(spawning.project + "__worktrees", name);
		if (existsSync(path)) throw new Error("Worktree path already exists (not owned): " + path);
		location = { cwd: path, project: spawning.project, worktree: path, branch: name };
	}
	if (options.worker && await workerThread(options.worker.handle, owning ? spawning.cwd : location.cwd, options.worker.run))
		throw new Error("Active worker already exists: " + options.worker.run + "/" + options.worker.handle);
	let thread: ThreadRecord | undefined;
	let file: string | undefined;
	try {
		const manager = source ? SessionManager.forkFrom(source, location.cwd, undefined, { id }) : SessionManager.create(location.cwd, undefined, { id });
		file = manager.getSessionFile()!;
		if (!source) await persistHeader(file, id, location.cwd);
		thread = {
			id, sessionId: manager.getSessionId(), sessionFile: file, ...location,
			ownership: owning ? "owner" : "guest", parent, archived: false, created: new Date().toISOString(),
			worker: options.worker, launch: options.launch,
		};
		await saveThread(thread);
		if (owning) {
			git(spawning.cwd, "worktree", "add", "-b", name, location.cwd, options.base ?? "HEAD");
			owned = true;
			location = checkout(location.cwd);
			thread = { ...thread, ...location };
			await saveThread(thread);
			git(location.cwd, "config", "branch." + location.branch + ".ab-parent", spawning.branch!);
			await setup(location.cwd);
		}
		launchAttempted = true;
		await ensureTerminal(id);
		return thread;
	} catch (error) {
		const cleanup: string[] = [];
		// No launch precedes registration. Failed setup/launch owns its partial path until cleanup succeeds.
		if (launchAttempted) {
			try { await zmx(["kill", id + ".agent", "--force"]); } catch (e) { cleanup.push(String(e)); }
		}
		if (owned && !cleanup.length) {
			try {
				git(spawning.cwd, "worktree", "remove", "--force", location.cwd);
				git(spawning.cwd, "branch", "-D", name);
			} catch (e) { cleanup.push(String(e)); }
		}
		if (thread && !cleanup.length) await saveThread({ ...thread, archived: true });
		if (file && !cleanup.length) await rm(file, { force: true });
		throw new Error("Thread " + id + " at " + location.cwd + " failed: " + String(error) + (cleanup.length ? "\nPartial resources remain registered: " + cleanup.join("\n") : "\nPartial resources cleaned"));
	}
}

export async function forkThread(source: string, options: NewThreadOptions = {}): Promise<ThreadRecord> {
	return newThread({ ...options, forkFrom: source });
}

export async function promoteThread(session: string, cwd = process.cwd()): Promise<ThreadRecord> {
	const file = await sessionFile(session, cwd);
	const current = readLive().find(l => l.sessionId === session || l.sessionFile === file);
	if (current) await persistHeader(file, current.sessionId, current.cwd);
	const header = await sessionHeader(file);
	const member = await threadForSession(header.id);
	if (member) return member;
	const collision = await getThread(header.id);
	if (collision) throw new Error("Session " + header.id + " is the immutable id of thread " + collision.id + " (current session " + collision.sessionId + "); fork it instead");
	const location = checkout(current?.cwd ?? header.cwd);
	const thread: ThreadRecord = {
		id: header.id, sessionId: header.id, sessionFile: file, ...location,
		ownership: "guest", archived: false, created: new Date().toISOString(),
	};
	await saveThread(thread);
	try { await ensureTerminal(thread.id); }
	catch (error) { throw new Error("Promoted thread " + thread.id + " at " + thread.cwd + " remains registered: " + String(error)); }
	return thread;
}

function mergeParent(thread: ThreadRecord): string | undefined {
	if (!thread.branch || thread.ownership !== "owner") return;
	try { return git(thread.project, "config", "--get", "branch." + thread.branch + ".ab-parent") || undefined; }
	catch (error) { if ((error as { status?: number }).status !== 1) throw error; }
}

function snapshot(thread: ThreadRecord, records: ThreadRecord[], inventory: ZmxTerminal[], live: Live[]): ThreadSnapshot {
	const canonical = live.filter(l => l.sessionId === thread.sessionId && (!l.sessionFile || l.sessionFile === thread.sessionFile));
	if (canonical.length > 1) throw new Error("Concurrent canonical pi writers for thread " + thread.id);
	const pi = canonical[0];
	const ownedTerminals = inventory.filter(t => t.thread === thread.id && t.role && t.name === thread.id + "." + t.role);
	const parent = mergeParent(thread);
	const parentThread = parent ? records.find(t => t.project === thread.project && t.ownership === "owner" && t.branch === parent) : undefined;
	const topic = thread.worker ? thread.worker.run + "/" + thread.worker.handle : "thread/" + thread.id;
	const report = read({ topic, tags: "done | blocked | needs-input | checkpoint | turn-end", limit: Infinity }).messages
		.filter(m => m.ts >= thread.created && (pi?.state !== "working" || m.ts >= pi.since) && (!isPiLaunch(thread.launch) || !m.from.session || m.from.session === thread.sessionId)).at(-1);
	const tag = ["done", "blocked", "needs-input", "checkpoint", "turn-end"].find(t => report?.tags.includes(t));
	const fixture = !isPiLaunch(thread.launch) && ownedTerminals.find(t => t.role === "agent");
	return {
		thread, state: pi?.state ?? (fixture && !fixture.ended ? "working" : "exited"), pid: pi?.pid,
		mergeParent: parent, mergeParentThread: parentThread?.id,
		terminals: ownedTerminals.map(t => ({ name: t.name, role: t.role! })),
		report: report && tag ? { tag, ts: report.ts, body: report.body } : undefined,
	};
}

export async function threadSnapshot(id: string): Promise<ThreadSnapshot> {
	const thread = await getThread(id);
	if (!thread) throw new Error("Unknown thread: " + id);
	return snapshot(thread, await allThreads(), await terminals(), readLive());
}

/** Active threads, globally unless cwd scopes a git project. */
export async function listThreads(options: { tree?: "spawn" | "merge"; cwd?: string } = {}): Promise<ThreadRow[]> {
	const project = options.cwd === undefined ? undefined : checkout(options.cwd).project;
	const records = (await allThreads()).filter(t => project === undefined || t.project === project);
	const inventory = await terminals(), live = readLive();
	const rows = records.map(t => {
		const snap = snapshot(t, records, inventory, live);
		return { ...snap, depth: 0, treeParent: options.tree === "merge" ? snap.mergeParentThread : t.parent };
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
	return ordered;
}

export async function ensureTerminal(id: string, role = "agent"): Promise<ThreadTerminal> {
	if (!/^[a-zA-Z0-9_.-]+$/.test(role)) throw new Error("Invalid terminal role: " + role);
	const thread = await activeThread(id);
	const terminal = { name: id + "." + role, role };
	await terminalLock(terminal.name, async () => {
		await activeThread(id);
		let existing = (await terminals()).find(t => t.name === terminal.name);
		if (existing && ((existing.thread && existing.thread !== id) || (existing.role && existing.role !== role)))
			throw new Error("Terminal has conflicting ownership: " + terminal.name);
		let launched = false;
		try {
			if (!existing) {
				const env = launchEnv(thread);
				const argv = role === "agent"
					? [executable("bun"), fileURLToPath(new URL("./agent-runner.ts", import.meta.url)), id]
					: [env.SHELL ?? process.env.SHELL ?? "/bin/sh", "-l"];
				launched = true;
				await zmx(["run", terminal.name, "-d", ...argv], thread.cwd, env);
			}
			await zmx(["set", terminal.name, "thread=" + id, "role=" + role]);
			existing = (await terminals()).find(t => t.name === terminal.name);
			if (!existing || existing.thread !== id || existing.role !== role) throw new Error("Terminal label readback failed: " + terminal.name);
		} catch (error) {
			if (launched) await zmx(["kill", terminal.name, "--force"]).catch(() => {});
			throw new Error("Thread " + id + " at " + thread.cwd + ": " + String(error));
		}
	});
	return terminal;
}

/** exclusive: detach every other client first, so one viewer owns the pty size. */
export async function attachThread(id: string, role = "agent", opts: { exclusive?: boolean } = {}): Promise<void> {
	const terminal = await ensureTerminal(id, role);
	const thread = await activeThread(id);
	const bin = await zmxBinary();
	if (opts.exclusive) await command(bin, ["detach"], undefined, { ...process.env, ZMX_SESSION: terminal.name, ZMX_SESSION_PREFIX: undefined }).catch(() => {});
	await new Promise<void>((resolve, reject) => {
		// Unlike background commands, attach deliberately keeps ZMX_SESSION for zmx's switch path.
		const env = { ...process.env };
		delete env.ZMX_SESSION_PREFIX;
		const child = spawn(bin, ["attach", terminal.name], { cwd: thread.cwd, env, stdio: "inherit" });
		child.once("error", reject);
		child.once("exit", code => code === 0 ? resolve() : reject(new Error("zmx attach " + terminal.name + " exited " + code)));
	});
}

export async function sendThread(id: string, text: string): Promise<void> {
	await activeThread(id);
	await zmx(["send", id + ".agent", text]);
}

export async function historyThread(id: string, lines?: number): Promise<string> {
	await getThread(id).then(t => { if (!t) throw new Error("Unknown thread: " + id); });
	if (lines !== undefined && (!Number.isInteger(lines) || lines < 0)) throw new Error("lines must be a nonnegative integer");
	const history = await zmx(["history", id + ".agent"]);
	if (lines === undefined) return history;
	const split = history.replace(/\n$/, "").split("\n");
	return lines === 0 ? "" : split.slice(-lines).join("\n") + (history.endsWith("\n") ? "\n" : "");
}
