// Workspaces: one per git worktree (main checkouts included), nested by the branch it came from,
// each shown as a tmux session whose windows hold agents and terminals. The session graph
// (graph.ts) supplies the agents; this joins them to worktrees and tmux panes.
//
// A worktree's parent: workmux's recorded base branch, else a branch-name prefix (Paseo's
// run/handle), else the older worktree it shares the newest merge-base with (else the main
// checkout). tmux sessions map to a workspace by the @ab-workspace option we set on sessions we
// create, else by their session path, else by where their panes are.

import { execFileSync } from "node:child_process";
import { existsSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import type { Node } from "./graph";

export interface Pane { id: string; pid: number; command: string; path: string; active: boolean; agent?: Node }
export interface Window { session: string; index: number; name: string; active: boolean; panes: Pane[] }
export interface Workspace {
	key: string; // worktree path, or "tmux:<session>" for sessions outside any repo
	path: string;
	project: string;
	branch?: string;
	main: boolean;
	parent?: string;
	children: string[];
	created: number;
	session?: string;
	windows: Window[];
	/** Agent sessions in this worktree: live ones, then recent resumable ones. */
	agents: Node[];
	diff?: { add: number; del: number };
	updated: string;
}

const git = (cwd: string, ...args: string[]): string => {
	try { return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 }).trim(); }
	catch { return ""; }
};
const real = (p: string) => { try { return realpathSync(p); } catch { return p; } };
const within = (root: string, p: string) => p === root || p.startsWith(root.endsWith("/") ? root : root + "/");

interface Tree { path: string; head: string; branch?: string }

function worktrees(root: string): Tree[] {
	const out: Tree[] = [];
	let cur: Partial<Tree> & { prunable?: boolean } = {};
	for (const line of (git(root, "worktree", "list", "--porcelain") + "\n").split("\n")) {
		if (!line) { if (cur.path && !cur.prunable && existsSync(cur.path)) out.push(cur as Tree); cur = {}; continue; }
		const [k, ...rest] = line.split(" ");
		const v = rest.join(" ");
		if (k === "worktree") cur.path = real(v);
		else if (k === "HEAD") cur.head = v;
		else if (k === "branch") cur.branch = v.replace(/^refs\/heads\//, "");
		else if (k === "prunable") cur.prunable = true;
	}
	return out;
}

/** Main checkout for any path in a repo. */
function repoRoot(path: string): string | undefined {
	const common = git(path, "rev-parse", "--path-format=absolute", "--git-common-dir");
	if (!common) return undefined;
	return real(common.endsWith("/.git") ? dirname(common) : common);
}

const mergeBaseCache = new Map<string, number>();
function forkTime(root: string, a: string, b: string): number {
	const k = a < b ? a + b : b + a;
	let t = mergeBaseCache.get(k);
	if (t === undefined) {
		const base = git(root, "merge-base", a, b);
		t = base ? Number(git(root, "show", "-s", "--format=%ct", base)) || 0 : 0;
		mergeBaseCache.set(k, t);
	}
	return t;
}

function created(root: string, t: Tree, main: boolean): number {
	if (main) return 0;
	const name = basename(git(t.path, "rev-parse", "--absolute-git-dir"));
	try { return statSync(join(root, ".git", "worktrees", name)).birthtimeMs; } catch { return Date.now(); }
}

function parents(root: string, trees: Tree[], made: Map<string, number>): Map<string, string> {
	const out = new Map<string, string>();
	const main = trees.find(t => t.path === root);
	const byBranch = new Map(trees.filter(t => t.branch).map(t => [t.branch!, t]));
	for (const t of trees) {
		if (t === main) continue;
		let parent: Tree | undefined;
		const base = t.branch ? git(root, "config", "--get", `branch.${t.branch}.workmux-base`) : "";
		if (base && byBranch.has(base)) parent = byBranch.get(base);
		for (let b = t.branch; !parent && b && b.includes("/");) { b = b.slice(0, b.lastIndexOf("/")); parent = byBranch.get(b); }
		if (!parent) {
			const floor = main ? forkTime(root, t.head, main.head) : 0;
			let best = floor;
			for (const v of trees) {
				if (v === t || v === main || made.get(v.path)! >= made.get(t.path)!) continue;
				const f = forkTime(root, t.head, v.head);
				if (f > best) { best = f; parent = v; }
			}
		}
		parent ??= main;
		if (parent && parent !== t) out.set(t.path, parent.path);
	}
	return out;
}

const diffCache = new Map<string, { at: number; value?: { add: number; del: number } }>();
function diffSize(path: string, against: string | undefined): { add: number; del: number } | undefined {
	const hit = diffCache.get(path);
	if (hit && Date.now() - hit.at < 20_000) return hit.value;
	let value: { add: number; del: number } | undefined;
	const base = against ? git(path, "merge-base", "HEAD", against) : "";
	if (base) {
		const s = git(path, "diff", "--shortstat", base);
		value = { add: Number(/(\d+) insertion/.exec(s)?.[1] ?? 0), del: Number(/(\d+) deletion/.exec(s)?.[1] ?? 0) };
	}
	diffCache.set(path, { at: Date.now(), value });
	return value;
}

interface TmuxPane { session: string; sessionPath: string; tag: string; window: number; windowName: string; windowActive: boolean; pane: string; pid: number; command: string; path: string; paneActive: boolean; sidebar: boolean }

function tmuxPanes(): TmuxPane[] {
	try {
		const f = ["#{session_name}", "#{session_path}", "#{@ab-workspace}", "#{window_index}", "#{window_name}", "#{window_active}", "#{pane_id}", "#{pane_pid}", "#{pane_current_command}", "#{pane_current_path}", "#{pane_active}", "#{@ab-sidebar-pane}"].join("\t");
		return execFileSync("tmux", ["list-panes", "-a", "-F", f], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\n").filter(Boolean).map(l => {
			const [session, sessionPath, tag, window, windowName, windowActive, pane, pid, command, path, paneActive, sidebar] = l.split("\t");
			return { session: session!, sessionPath: real(sessionPath!), tag: tag!, window: Number(window), windowName: windowName!, windowActive: windowActive === "1", pane: pane!, pid: Number(pid), command: command!, path: real(path!), paneActive: paneActive === "1", sidebar: sidebar === "1" };
		});
	} catch { return []; }
}

/** pid → ppid, to find which pane a pi process runs under. */
function parentsOfPids(): Map<number, number> {
	const out = new Map<number, number>();
	try {
		for (const line of execFileSync("ps", ["-Ao", "pid=,ppid="], { encoding: "utf8" }).split("\n")) {
			const [pid, ppid] = line.trim().split(/\s+/).map(Number);
			if (pid) out.set(pid, ppid!);
		}
	} catch {}
	return out;
}

const ACTIVE = new Set(["working", "idle", "live"]);

export function workspaces(nodes: Map<string, Node>, opts: { recent?: number; pinned?: string[]; hidden?: string[] } = {}): Map<string, Workspace> {
	const panes = tmuxPanes().filter(p => !p.sidebar);
	const roots = new Set<string>();
	const cutoff = new Date(Date.now() - 2 * 86_400_000).toISOString();
	const rootOf = new Map<string, string | undefined>();
	const root = (p: string) => { if (!rootOf.has(p)) rootOf.set(p, existsSync(p) ? repoRoot(p) : undefined); return rootOf.get(p); };
	for (const n of nodes.values()) if (ACTIVE.has(n.state) || (n.state !== "gone" && n.updated >= cutoff)) { const r = root(n.cwd); if (r) roots.add(r); }
	for (const p of panes) { const r = root(p.tag || p.sessionPath || p.path); if (r) roots.add(r); }
	for (const p of opts.pinned ?? []) { const r = root(p); if (r) roots.add(r); }
	for (const p of opts.hidden ?? []) roots.delete(real(p));

	const out = new Map<string, Workspace>();
	for (const r of roots) {
		const trees = worktrees(r);
		const made = new Map(trees.map(t => [t.path, created(r, t, t.path === r)]));
		const parent = parents(r, trees, made);
		for (const t of trees) {
			out.set(t.path, { key: t.path, path: t.path, project: basename(r), branch: t.branch, main: t.path === r, parent: parent.get(t.path),
				children: [], created: made.get(t.path)!, windows: [], agents: [], updated: new Date(made.get(t.path) || 0).toISOString() });
		}
	}
	const paths = [...out.keys()].sort((a, b) => b.length - a.length);
	const owner = (p: string) => paths.find(w => within(w, p));

	// tmux sessions → workspaces
	const sessionOwner = new Map<string, string>();
	for (const p of panes) {
		if (sessionOwner.has(p.session)) continue;
		const byTag = p.tag && out.has(real(p.tag)) ? real(p.tag) : undefined;
		const byPath = owner(p.sessionPath) ?? panes.filter(q => q.session === p.session).map(q => owner(q.path)).find(Boolean);
		// A session named after a project whose directory is gone: that project's main checkout.
		const byName = [...out.values()].find(w => w.main && w.project === p.session)?.key;
		sessionOwner.set(p.session, byTag ?? byPath ?? byName ?? "tmux:" + p.session);
	}
	const ppid = parentsOfPids();
	const paneOfPid = new Map<number, string>();
	const panePids = new Map(panes.map(p => [p.pid, p.pane]));
	for (const n of nodes.values()) {
		if (!n.pid) continue;
		for (let pid: number | undefined = n.pid, i = 0; pid && i < 20; pid = ppid.get(pid), i++) {
			const pane = panePids.get(pid);
			if (pane) { paneOfPid.set(n.pid, pane); break; }
		}
	}
	const agentOfPane = new Map<string, Node>();
	for (const n of nodes.values()) {
		const pane = (n.pane && panes.some(p => p.pane === n.pane) ? n.pane : undefined) ?? (n.pid ? paneOfPid.get(n.pid) : undefined);
		if (pane && ACTIVE.has(n.state)) { const prev = agentOfPane.get(pane); if (!prev || (prev.parent === n.id)) agentOfPane.set(pane, n); }
	}
	for (const p of panes) {
		const key = sessionOwner.get(p.session)!;
		let w = out.get(key);
		if (!w) {
			w = { key, path: p.sessionPath || p.path, project: "tmux", main: false, children: [], created: 0, windows: [], agents: [], updated: new Date(0).toISOString() };
			out.set(key, w);
		}
		w.session = p.session;
		let win = w.windows.find(x => x.session === p.session && x.index === p.window);
		if (!win) { win = { session: p.session, index: p.window, name: p.windowName, active: p.windowActive, panes: [] }; w.windows.push(win); }
		win.panes.push({ id: p.pane, pid: p.pid, command: p.command, path: p.path, active: p.paneActive, agent: agentOfPane.get(p.pane) });
	}

	// agents → workspaces: live ones, then a few recent resumable ones
	const recent = opts.recent ?? 3;
	const byWs = new Map<string, Node[]>();
	for (const n of nodes.values()) {
		if (n.state === "gone") continue;
		const key = owner(real(n.cwd));
		if (!key) continue;
		if (!byWs.has(key)) byWs.set(key, []);
		byWs.get(key)!.push(n);
	}
	for (const [key, list] of byWs) {
		const w = out.get(key)!;
		list.sort((a, b) => b.updated.localeCompare(a.updated));
		const live = list.filter(n => ACTIVE.has(n.state));
		const rest = list.filter(n => !ACTIVE.has(n.state) && n.updated >= cutoff).slice(0, recent);
		w.agents = [...live, ...rest];
		if (list[0] && list[0].updated > w.updated) w.updated = list[0].updated;
	}
	for (const w of out.values()) {
		w.windows.sort((a, b) => a.index - b.index);
		if (w.parent && out.has(w.parent)) out.get(w.parent)!.children.push(w.key);
		if (!w.main && w.path && existsSync(w.path) && !w.key.startsWith("tmux:")) w.diff = diffSize(w.path, w.parent && out.get(w.parent)?.branch ? out.get(w.parent)!.branch : w.parent ? git(w.parent, "rev-parse", "HEAD") : undefined);
	}
	// Drop worktrees nobody has touched in the window and that aren't open: keeps old /tmp checkouts out.
	for (const [key, w] of out) if (!w.main && !w.session && !w.agents.length && !w.children.length) out.delete(key);
	for (const w of out.values()) w.children = w.children.filter(c => out.has(c));
	return out;
}

export function label(w: Workspace): string {
	if (w.key.startsWith("tmux:")) return w.session ?? w.key.slice(5);
	if (w.main) return w.branch ?? basename(w.path);
	return (w.branch ?? basename(w.path)).split("/").pop()!;
}

export const home = (p: string) => p.replace(homedir(), "~");
export const rel = (from: string, p: string) => { const r = relative(from, p); return r && !r.startsWith("..") ? r : home(p); };
