// Session graph: every pi session as a node, joined to its parent, project, live process and
// last board report. Sessions are files, so a parked session (no process) is still a node and
// an orphan (live, but its parent has ended) is visible. Views (ab tree, sidebar, dashboard)
// render this; nothing here depends on the multiplexer.
//
// Sources: session jsonl headers/meta (parent links: wm's session-meta.parentSession, the bash
// tool's PI_SESSION_ID as invokedBy, pi's fork header, Paseo's parent-agent label), live records
// from lib/session-meta/live.ts, the board log, and git for project names. Parsed files are cached
// by (mtime, size) in ~/.cache/ab-tree/index.json.

import { execFileSync } from "node:child_process";
import { closeSync, existsSync, fstatSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { readLive, type Live } from "../session-meta/live";
import { logPath } from "../board/store";

export type State = "working" | "idle" | "live" | "parked" | "ended" | "gone";
export interface Node {
	id: string;
	file: string;
	cwd: string;
	project: string;
	title: string;
	model?: string;
	created: string;
	updated: string;
	parent?: string;
	parentKind?: "spawn" | "invoked" | "fork" | "paseo";
	run?: string;
	handle?: string;
	paseoAgent?: string;
	state: State;
	pid?: number;
	pane?: string;
	report?: { tag: string; ts: string; body: string };
	/** Live or parked while its parent has ended, or its parent is unknown. */
	orphan?: boolean;
	lastText?: string;
	children: string[];
}

interface Parsed {
	mtimeMs: number; size: number;
	id: string; cwd: string; created: string; forkOf?: string; name?: string; firstUser?: string;
	model?: string; lastText?: string;
	meta?: { run?: string; handle?: string; parentSession?: string; paseoAgent?: string; invokedBy?: string };
}
interface Cache { files: Record<string, Parsed>; projects: Record<string, string>; paseoParents: Record<string, string>; paseoSessions: Record<string, string>; paseoTitles: Record<string, string> }

const SESSIONS = join(process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi/agent"), "sessions");
const CACHE = join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "ab-tree", "index.json");
const HEAD = 64 * 1024, TAIL = 96 * 1024;

function slice(fd: number, start: number, length: number): string {
	const buf = Buffer.alloc(length);
	const n = readSync(fd, buf, 0, length, start);
	return buf.subarray(0, n).toString("utf8");
}
const text = (content: unknown): string => typeof content === "string" ? content
	: Array.isArray(content) ? content.map((c: any) => c?.type === "text" ? c.text : "").join("") : "";

function parse(file: string, mtimeMs: number, size: number): Parsed | undefined {
	const fd = openSync(file, "r");
	try {
		const head = slice(fd, 0, Math.min(HEAD, size)).split("\n");
		if (size > HEAD) head.pop();
		const tail = size > HEAD ? slice(fd, Math.max(HEAD, size - TAIL), Math.min(TAIL, size - HEAD)).split("\n").slice(1) : [];
		let header: any;
		try { header = JSON.parse(head[0]!); } catch { return undefined; }
		if (header?.type !== "session") return undefined;
		const p: Parsed = { mtimeMs, size, id: header.id, cwd: header.cwd, created: header.timestamp, forkOf: header.parentSession };
		for (const line of [...head.slice(1), ...tail]) {
			if (!line) continue;
			let e: any;
			try { e = JSON.parse(line); } catch { continue; }
			if (e.type === "model_change") p.model = e.provider + "/" + e.modelId;
			else if (e.type === "session_info" && e.name) p.name = e.name;
			else if (e.type === "custom" && e.customType === "session-meta") p.meta = e.data;
			else if (e.type === "message") {
				const m = e.message;
				if (m?.role === "user" && !p.firstUser) p.firstUser = text(m.content).slice(0, 200);
				else if (m?.role === "assistant") { const t = text(m.content).trim(); if (t) p.lastText = t.slice(-400); if (m.model) p.model = (m.provider ? m.provider + "/" : "") + m.model; }
			}
		}
		return p;
	} finally { closeSync(fd); }
}

function load(): Cache {
	const empty = (): Cache => ({ files: {}, projects: {}, paseoParents: {}, paseoSessions: {}, paseoTitles: {} });
	try { return { ...empty(), ...JSON.parse(readFileSync(CACHE, "utf8")) }; }
	catch { return empty(); }
}

/** Project name for a cwd: the main checkout's directory name, via git's common dir. */
function project(cwd: string, cache: Cache): string {
	const known = cache.projects[cwd];
	if (known) return known;
	let name: string | undefined;
	if (existsSync(cwd)) {
		try {
			const common = execFileSync("git", ["-C", cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
			name = basename(common.endsWith("/.git") ? dirname(common) : common.replace(/\.git$/, ""));
		} catch { name = basename(cwd); }
	} else {
		// Deleted worktree: a sibling under the same worktree root that still resolved, or workmux's layout.
		const root = dirname(cwd);
		let sibling: string | undefined;
		try { sibling = readdirSync(root).map(n => join(root, n)).find(d => d !== cwd && existsSync(join(d, ".git"))); } catch {}
		name = (sibling ? project(sibling, cache) : undefined)
			?? Object.entries(cache.projects).find(([dir]) => dirname(dir) === root && dir !== cwd)?.[1]
			?? /\/([^/]+)__worktrees\//.exec(cwd)?.[1] ?? basename(cwd);
	}
	cache.projects[cwd] = name;
	return name;
}

function reports(): Map<string, { tag: string; ts: string; body: string }> {
	const out = new Map<string, { tag: string; ts: string; body: string }>();
	let log = "";
	try { log = readFileSync(logPath(), "utf8"); } catch { return out; }
	for (const line of log.split("\n")) {
		if (!line) continue;
		try {
			const m = JSON.parse(line);
			const tag = (m.tags as string[]).find(t => ["done", "blocked", "needs-input", "checkpoint"].includes(t));
			if (tag) out.set(m.topic, { tag, ts: m.ts, body: String(m.body).slice(0, 200) });
		} catch {}
	}
	return out;
}

/** Paseo's parent labels, merged into the cache so they outlive the agents. Best effort, 3s. */
async function paseoParents(cache: Cache): Promise<void> {
	try {
		const { withClient } = await import("../paseo.ts");
		const entries = await Promise.race([
			withClient(async c => {
				const all = [];
				let cursor: string | null | undefined;
				do {
					const page = await c.agents.list({ filter: { includeArchived: true }, page: { limit: 200, ...(cursor ? { cursor } : {}) } } as any);
					all.push(...page.entries);
					cursor = page.pageInfo.hasMore ? page.pageInfo.nextCursor : undefined;
				} while (cursor && all.length < 5000);
				return all;
			}),
			new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
		]);
		for (const { agent } of entries) {
			const parent = agent.labels?.["paseo.parent-agent-id"];
			if (parent) cache.paseoParents[agent.id] = parent;
			// Imported sessions record their agent id late in the file; Paseo knows the pi session directly.
			const session = agent.persistence?.sessionId ?? agent.runtimeInfo?.sessionId;
			if (session) cache.paseoSessions[agent.id] = session;
			if (agent.title) cache.paseoTitles[agent.id] = agent.title;
		}
	} catch {}
}

export interface Options { days?: number; paseo?: boolean }

export async function graph(options: Options = {}): Promise<Map<string, Node>> {
	const cache = load();
	const since = Date.now() - (options.days ?? 3) * 86_400_000;
	const live = readLive();
	const liveBySession = new Map<string, Live>(live.map(l => [l.sessionId, l]));
	const paseoProcs = paseoProcesses();
	if (options.paseo !== false) await paseoParents(cache);

	// Files in the window, live ones, and (below) ancestors of either.
	const byId = new Map<string, string>();
	const files: string[] = [];
	for (const dir of readdirSync(SESSIONS)) {
		let names: string[];
		try { names = readdirSync(join(SESSIONS, dir)); } catch { continue; }
		for (const name of names) {
			if (!name.endsWith(".jsonl")) continue;
			const path = join(SESSIONS, dir, name);
			const id = name.slice(name.indexOf("_") + 1, -6);
			byId.set(id, path);
			files.push(path);
		}
	}
	for (const l of live) if (l.sessionFile) byId.set(l.sessionId, l.sessionFile);

	const parsed = new Map<string, Parsed>();
	const read = (path: string): Parsed | undefined => {
		const hit = parsed.get(path);
		if (hit) return hit;
		let st;
		try { st = statSync(path); } catch { return undefined; }
		let p: Parsed | undefined = cache.files[path];
		if (!p || p.mtimeMs !== st.mtimeMs || p.size !== st.size) {
			p = parse(path, st.mtimeMs, st.size);
			if (p) cache.files[path] = p;
		}
		if (p) parsed.set(path, p);
		return p;
	};
	const want = new Set<string>();
	for (const path of files) {
		let mtime = 0;
		try { mtime = statSync(path).mtimeMs; } catch { continue; }
		if (mtime >= since) want.add(path);
	}
	for (const l of live) if (l.sessionFile) want.add(l.sessionFile);

	const paseoSession = new Map<string, string>(Object.entries(cache.paseoSessions));
	const parentOf = (p: Parsed): { id?: string; kind?: Node["parentKind"] } => {
		if (p.meta?.parentSession) return { id: p.meta.parentSession, kind: "spawn" };
		if (p.meta?.paseoAgent && cache.paseoParents[p.meta.paseoAgent]) return { id: "paseo:" + cache.paseoParents[p.meta.paseoAgent], kind: "paseo" };
		if (p.meta?.invokedBy && p.meta.invokedBy !== p.id) return { id: p.meta.invokedBy, kind: "invoked" };
		if (p.forkOf) return { id: basename(p.forkOf).slice(basename(p.forkOf).indexOf("_") + 1, -6), kind: "fork" };
		return {};
	};
	// Paseo parents are agent ids; resolving one to its session needs every session's agent id.
	// Parsed once, then cached by mtime, so this is a stat per file after the first run.
	if (Object.keys(cache.paseoParents).length) for (const path of files) {
		const p = read(path);
		if (p?.meta?.paseoAgent && (!paseoSession.has(p.meta.paseoAgent) || p.created > read(byId.get(paseoSession.get(p.meta.paseoAgent)!)!)!.created)) {
			paseoSession.set(p.meta.paseoAgent, p.id);
		}
	}
	// Pull in ancestors so every shown node has its chain.
	const queue = [...want];
	while (queue.length) {
		const p = read(queue.pop()!);
		if (!p) continue;
		let { id } = parentOf(p);
		if (id?.startsWith("paseo:")) id = paseoSession.get(id.slice(6));
		const path = id ? byId.get(id) : undefined;
		if (path && !want.has(path)) { want.add(path); queue.push(path); }
	}

	// Several agents can share a session (archive then import): prefer the one with a process.
	const agentOf = new Map<string, string>();
	for (const [agent, session] of Object.entries(cache.paseoSessions)) if (!agentOf.has(session) || paseoProcs.has(agent)) agentOf.set(session, agent);
	const board = reports();
	const nodes = new Map<string, Node>();
	for (const path of want) {
		const p = read(path);
		if (!p) continue;
		let { id: parent, kind } = parentOf(p);
		if (parent?.startsWith("paseo:")) parent = paseoSession.get(parent.slice(6)) ?? parent;
		// Paseo's own mapping wins: an imported session keeps the meta of the agent that first ran it.
		const paseoAgent = agentOf.get(p.id) ?? p.meta?.paseoAgent;
		const proc = paseoAgent ? paseoProcs.get(paseoAgent) : undefined;
		const l = liveBySession.get(p.id) ?? (proc ? { pid: proc, state: "live" as const, tmuxPane: undefined } : undefined);
		const exists = existsSync(p.cwd);
		const state: State = l ? l.state : !exists ? "gone" : isWorktree(p.cwd) ? "parked" : "ended";
		const run = p.meta?.run, handle = p.meta?.handle;
		nodes.set(p.id, {
			id: p.id, file: path, cwd: p.cwd, project: project(p.cwd, cache),
			title: p.name ?? (paseoAgent ? cache.paseoTitles[paseoAgent] : undefined) ?? (run && handle ? run + "/" + handle : undefined) ?? p.firstUser?.split("\n")[0] ?? "(empty)",
			model: p.model, created: p.created, updated: new Date(p.mtimeMs).toISOString(),
			parent, parentKind: kind, run, handle, paseoAgent,
			state, pid: l?.pid, pane: l?.tmuxPane, report: run && handle ? board.get(run + "/" + handle) : undefined,
			lastText: p.lastText, children: [],
		});
	}
	for (const node of nodes.values()) {
		const parent = node.parent ? nodes.get(node.parent) : undefined;
		if (parent) parent.children.push(node.id);
		const alive = node.state === "working" || node.state === "idle" || node.state === "live" || node.state === "parked";
		const parentAlive = parent && ["working", "idle", "live", "parked"].includes(parent.state);
		if (alive && node.parent && node.parentKind !== "fork" && !parentAlive) node.orphan = true;
	}
	for (const node of nodes.values()) node.children.sort((a, b) => nodes.get(a)!.created.localeCompare(nodes.get(b)!.created));

	mkdirSync(dirname(CACHE), { recursive: true });
	writeFileSync(CACHE, JSON.stringify(cache));
	return nodes;
}

/** Paseo agent id → pi pid, for processes started before live records existed. Only pi processes
 * the Paseo daemon started directly: pi run from an agent's bash tool inherits PASEO_AGENT_ID too. */
function paseoProcesses(): Map<string, number> {
	const out = new Map<string, number>();
	try {
		const rows = execFileSync("ps", ["-Ao", "pid=,ppid=,command=", "-ww", "-E"], { encoding: "utf8", maxBuffer: 1 << 26 }).split("\n")
			.map(line => /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line)).filter(Boolean).map(m => ({ pid: Number(m![1]), ppid: Number(m![2]), command: m![3]! }));
		const command = new Map(rows.map(r => [r.pid, r.command]));
		for (const r of rows) {
			if (!r.command.includes("pi-coding-agent")) continue;
			const id = /PASEO_AGENT_ID=(\S+)/.exec(r.command)?.[1];
			if (id && /Paseo/.test(command.get(r.ppid) ?? "")) out.set(id, r.pid);
		}
	} catch {}
	return out;
}

const worktrees = new Map<string, boolean>();
/** A linked git worktree (its .git is a file), i.e. something a parked session keeps alive. */
function isWorktree(cwd: string): boolean {
	let hit = worktrees.get(cwd);
	if (hit === undefined) {
		try { hit = statSync(join(cwd, ".git")).isFile(); } catch { hit = false; }
		worktrees.set(cwd, hit);
	}
	return hit;
}
