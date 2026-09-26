// Session graph: every pi session as a node, joined to its parent, project, live process and
// last board report. Sessions are files, so a resumable session (no process) is still a node and
// an orphan (live, but its parent has ended) is visible. Views (ab tree, sidebar, dashboard)
// render this; nothing here depends on the multiplexer.
//
// Sources: session jsonl headers/meta (parent links: wm's session-meta.parentSession, the bash
// tool's PI_SESSION_ID as invokedBy, pi's fork header), live records
// from lib/session-meta/live.ts, the board log, and git for project names. Parsed files are cached
// by (mtime, size) in ~/.cache/ab-tree/index.json.

import { execFileSync } from "node:child_process";
import { closeSync, existsSync, fstatSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { readLive, type Live } from "../session-meta/live";
import { logPath } from "../board/store";
import { resolveSession } from "../session-meta/identity";

/** working/idle: a pi with a live record;
 * resumable: no process, reopen with pi --session; gone: its directory was deleted. */
export type State = "working" | "idle" | "resumable" | "gone";
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
	parentKind?: "spawn" | "invoked" | "fork";
	run?: string;
	handle?: string;
	state: State;
	/** User-facing session: not agent-spawned, and not running headless. */
	interactive: boolean;
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
	meta?: { run?: string; handle?: string; parentSession?: string; invokedBy?: string; mode?: Live["mode"] };
}
interface Cache { files: Record<string, Parsed>; projects: Record<string, string> }

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
	const empty = (): Cache => ({ files: {}, projects: {} });
	try { const c = JSON.parse(readFileSync(CACHE, "utf8")); return { files: c.files ?? {}, projects: c.projects ?? {} }; }
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

export interface Options { days?: number }

export async function graph(options: Options = {}): Promise<Map<string, Node>> {
	const cache = load();
	const since = Date.now() - (options.days ?? 3) * 86_400_000;
	const live = readLive();
	const liveBySession = new Map<string, Live>(live.map(l => [l.sessionId, l]));

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

	const parentOf = (p: Parsed): { id?: string; kind?: Node["parentKind"] } => {
		if (p.meta?.parentSession) return { id: resolveSession(p.meta.parentSession, byId.keys()) ?? p.meta.parentSession, kind: "spawn" };
		if (p.meta?.invokedBy && p.meta.invokedBy !== p.id) return { id: p.meta.invokedBy, kind: "invoked" };
		if (p.forkOf) return { id: basename(p.forkOf).slice(basename(p.forkOf).indexOf("_") + 1, -6), kind: "fork" };
		return {};
	};
	// Pull in ancestors so every shown node has its chain.
	const queue = [...want];
	while (queue.length) {
		const p = read(queue.pop()!);
		if (!p) continue;
		const { id } = parentOf(p);
		const path = id ? byId.get(id) : undefined;
		if (path && !want.has(path)) { want.add(path); queue.push(path); }
	}

	const board = reports();
	const nodes = new Map<string, Node>();
	for (const path of want) {
		const p = read(path);
		if (!p) continue;
		const { id: parent, kind } = parentOf(p);
		const l = liveBySession.get(p.id);
		const exists = existsSync(p.cwd);
		const state: State = l ? l.state : !exists ? "gone" : "resumable";
		const run = p.meta?.run, handle = p.meta?.handle;
		nodes.set(p.id, {
			id: p.id, file: path, cwd: p.cwd, project: project(p.cwd, cache),
			title: p.name ?? (run && handle ? run + "/" + handle : undefined) ?? p.firstUser?.split("\n")[0] ?? "(empty)",
			model: p.model, created: p.created, updated: new Date(p.mtimeMs).toISOString(),
			parent, parentKind: kind, run, handle,
			state, interactive: kind !== "spawn" && kind !== "invoked" && !p.meta?.run && (l?.mode ?? p.meta?.mode ?? "tui") === "tui",
			pid: l?.pid, pane: l?.tmuxPane, report: run && handle ? board.get(run + "/" + handle) : undefined,
			lastText: p.lastText, children: [],
		});
	}
	for (const node of nodes.values()) {
		const parent = node.parent ? nodes.get(node.parent) : undefined;
		if (parent) parent.children.push(node.id);
		// Kept: running, or resumable inside an unmerged worktree (work still pending).
		const kept = (x: Node) => x.state === "working" || x.state === "idle" || (x.state === "resumable" && isWorktree(x.cwd));
		const alive = kept(node);
		const parentAlive = parent && kept(parent);
		if (alive && node.parent && node.parentKind !== "fork" && !parentAlive) node.orphan = true;
	}
	for (const node of nodes.values()) node.children.sort((a, b) => nodes.get(a)!.created.localeCompare(nodes.get(b)!.created));

	mkdirSync(dirname(CACHE), { recursive: true });
	writeFileSync(CACHE, JSON.stringify(cache));
	return nodes;
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
