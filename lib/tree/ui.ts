// ab tree's TUI. Workspaces (worktrees ↔ tmux sessions) hold windows with agents and terminals.
//   dashboard: workspace tree on the left, the selected workspace's windows and agents on the
//              right (l/→ to enter it), a live preview underneath; closes after a jump.
//   sidebar:   workspace, status, or project/session tree; stays open (Ghostty split).
//   agents:    every agent grouped by state, across workspaces (s in the dashboard).
// Mouse: click selects (a second click, or any click in the sidebar, opens), wheel scrolls,
// clicking a fold arrow folds. UI state persists in ~/.local/state/ab-tree/ui.json.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parseKey, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { graph, type Node } from "./graph";
import { age, attention, ICON, matcher, rows as agentRows, type Row } from "./view";
import { label, home, workspaces, unattachedWorktrees, type Window, type Workspace } from "./workspaces";
import * as act from "./actions";
import { transcriptTail } from "./tail";
import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import * as ghostty from "./ghostty";

const STATE = join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"), "ab-tree", "ui.json");
const PROJECTS = join(dirname(STATE), "projects.json");
interface Projects { pinned: string[]; hidden: string[] }
const loadProjects = (): Projects => { try { return { pinned: [], hidden: [], ...JSON.parse(readFileSync(PROJECTS, "utf8")) }; } catch { return { pinned: [], hidden: [] }; } };
const saveProjects = (p: Projects) => { mkdirSync(dirname(PROJECTS), { recursive: true }); writeFileSync(PROJECTS, JSON.stringify(p, null, 2)); };
/** A typed project: a path, or anything zoxide knows. */
function resolveProject(text: string): string | undefined {
	const t = text.trim().replace(/^~(?=\/|$)/, homedir());
	if (!t) return undefined;
	if (existsSync(t)) return realpathSync(resolve(t));
	try { return execFileSync("zoxide", ["query", ...t.split(/\s+/)], { encoding: "utf8" }).trim() || undefined; } catch { return undefined; }
}
interface Saved { collapsed: string[]; preview: number; view: "workspaces" | "agents" | "tree"; sidebarView?: "workspaces" | "agents" | "tree"; sidebarWidth?: number }
type Left = { kind: "project"; project: string; count: number } | { kind: "ws"; w: Workspace; depth: number };
type Right = { kind: "window"; win: Window } | { kind: "agent"; n: Node; depth: number };

const c = (code: string, s: string) => `\x1b[${code}m${s}\x1b[0m`;
const STATE_COLOR: Record<string, string> = { working: "32", idle: "33", live: "36", resumable: "90", gone: "90" };
const RANK = ["needs", "blocked", "working", "idle"];

/** Most urgent thing in a workspace, for its row. */
function rollup(w: Workspace): { icon: string; counts: string } {
	const live = w.agents.filter(n => n.state === "working" || n.state === "idle");
	const keys = live.map(n => attention(n) === "needs" ? "needs" : attention(n) === "blocked" ? "blocked" : n.state);
	const top = keys.sort((a, b) => RANK.indexOf(a) - RANK.indexOf(b))[0];
	const icon = top === "needs" ? c("1;31", "!") : top === "blocked" ? c("31", "⊘") : top ? c(STATE_COLOR[top]!, ICON[top as keyof typeof ICON]) : w.session ? c("37", "□") : c("34", "◇");
	const n = (s: string) => live.filter(x => x.state === s).length;
	const counts = [n("working") && c("32", n("working") + "●"), n("idle") && c("33", n("idle") + "○")].filter(Boolean).join(" ");
	return { icon, counts };
}

export async function ui(opts: { sidebar?: boolean; query?: string }) {
	const saved: Saved = { collapsed: [], preview: 45, view: "workspaces", ...(() => { try { return JSON.parse(readFileSync(STATE, "utf8")); } catch { return {}; } })() };
	const sidebar = !!opts.sidebar;
	const collapsed = new Set(saved.collapsed);
	let preview = saved.preview;
	let view: Saved["view"] = sidebar ? saved.sidebarView ?? "workspaces" : saved.view;
	let query = opts.query ?? "";
	let input: { kind: "filter" | "send" | "branch" | "confirm"; text: string; then?: (text: string) => void; prompt?: string } | undefined;
	/** Pane the keyboard is passed through to (i on a window or agent with a pane). */
	let pass: string | undefined;
	let passTimer: ReturnType<typeof setInterval> | undefined;
	let nodes = new Map<string, Node>();
	let spaces = new Map<string, Workspace>();
	let left: Left[] = [], right: Right[] = [], agents: Row[] = [];
	let selLeft: string | undefined, selRight = 0, selAgent: string | undefined, selTree: string | undefined;
	let focus: "left" | "right" = "left";
	let message = "";
	let help = false;
	let current: string | undefined;
	let geometry: { y: number; x0: number; x1: number; act: (dbl: boolean) => void; fold?: () => void; foldX?: number }[] = [];

	const save = () => {
		mkdirSync(dirname(STATE), { recursive: true });
		writeFileSync(STATE, JSON.stringify({ ...saved, collapsed: [...collapsed], preview, ...(sidebar ? { sidebarView: view } : { view }) }));
	};
	const leftKey = (r: Left) => r.kind === "project" ? "project:" + r.project : r.w.key;

	const buildLeft = () => {
		const match = query ? matcher(query) : undefined;
		const ok = (w: Workspace) => !match || w.agents.some(match) || [label(w), w.project, w.branch ?? "", w.path].join(" ").toLowerCase().includes(query.toLowerCase());
		const shown = new Set([...spaces.values()].filter(ok).map(w => w.key));
		for (const k of [...shown]) { let p = spaces.get(k)?.parent; while (p && spaces.has(p) && !shown.has(p)) { shown.add(p); p = spaces.get(p)!.parent; } }
		const roots = [...shown].map(k => spaces.get(k)!).filter(w => !w.parent || !shown.has(w.parent));
		const byProject = new Map<string, Workspace[]>();
		const recency = (w: Workspace): string => [w.updated, ...w.children.filter(k => spaces.has(k)).map(k => recency(spaces.get(k)!))].sort().pop()!;
		for (const w of roots.sort((a, b) => recency(b).localeCompare(recency(a)))) { if (!byProject.has(w.project)) byProject.set(w.project, []); byProject.get(w.project)!.push(w); }
		// The tmux heading is an action target even before any free sessions exist.
		if (!byProject.has("tmux")) byProject.set("tmux", []);
		left = [];
		for (const [project, list] of byProject) {
			const count = [...shown].filter(k => spaces.get(k)!.project === project).length;
			left.push({ kind: "project", project, count });
			if (collapsed.has("project:" + project)) continue;
			const walk = (w: Workspace, depth: number) => {
				left.push({ kind: "ws", w, depth });
				if (collapsed.has(w.key)) return;
				for (const k of w.children.filter(k => shown.has(k)).sort((a, b) => recency(spaces.get(b)!).localeCompare(recency(spaces.get(a)!)))) walk(spaces.get(k)!, depth + 1);
			};
			for (const w of list.sort((a, b) => Number(b.main) - Number(a.main))) walk(w, 1);
		}
		if (!left.some(r => leftKey(r) === selLeft)) selLeft = (left.find(r => r.kind === "ws" && r.w.session === current) ?? left.find(r => r.kind === "ws") ?? left[0]) && leftKey((left.find(r => r.kind === "ws" && r.w.session === current) ?? left.find(r => r.kind === "ws") ?? left[0])!);
	};
	const workspaceFor = (n?: Node): Workspace | undefined => n && ([...spaces.values()].find(w => w.agents.some(a => a.id === n.id)) ?? spaces.get([...spaces.keys()].sort((a, b) => b.length - a.length).find(k => n.cwd === k || n.cwd.startsWith(k + "/")) ?? ""));
	const selectedWs = (): Workspace | undefined => { const r = left.find(x => leftKey(x) === selLeft); return r?.kind === "ws" ? r.w : undefined; };
	const buildRight = () => {
		const w = selectedWs();
		right = [];
		if (!w) return;
		const inPane = new Set<string>();
		for (const win of w.windows) { right.push({ kind: "window", win }); for (const p of win.panes) if (p.agent) inPane.add(p.agent.id); }
		const rest = w.agents.filter(n => !inPane.has(n.id));
		const ids = new Set(rest.map(n => n.id));
		const walk = (n: Node, depth: number) => { right.push({ kind: "agent", n, depth }); for (const k of n.children) { const ch = rest.find(x => x.id === k); if (ch) walk(ch, depth + 1); } };
		for (const n of rest) if (!n.parent || !ids.has(n.parent)) walk(n, 0);
		selRight = Math.min(selRight, Math.max(0, right.length - 1));
	};
	const rebuild = () => {
		buildLeft(); buildRight();
		agents = agentRows(nodes, view === "tree" ? "tree" : "status", { query: query || undefined, collapsed: new Set(collapsed) });
		if (!agents.some(r => r.node?.id === selAgent)) selAgent = agents.find(r => r.node)?.node!.id;
		if (view === "tree" && !agents.some(r => treeKey(r) === selTree)) selTree = agents.find(r => r.node?.id === selAgent)?.node ? "tree:session:" + selAgent : agents[0] && treeKey(agents[0]);
	};

	let refreshing = false;
	const refresh = async () => {
		if (refreshing || input) return;
		refreshing = true;
		try {
			nodes = await graph({ days: 2 });
			spaces = workspaces(nodes, loadProjects());
			const was = current;
			current = act.currentSession();
			// The sidebar's selection follows where you are when you move by other means.
			if (sidebar && current !== was) { const here = [...spaces.values()].find(w => w.session === current); if (here) selLeft = here.key; }
			rebuild();
			draw();
		} catch (e) { message = String(e); draw(); }
		finally { refreshing = false; }
	};

	const out = process.stdout;
	const W = () => out.columns || 80, H = () => out.rows || 24;

	const leftLine = (r: Left, width: number): string => {
		if (r.kind === "project") return truncateToWidth(c("1", `${collapsed.has("project:" + r.project) ? "▸" : "▾"} ${r.project}`) + c("90", ` ${r.count}`), width);
		const w = r.w, { icon, counts } = rollup(w);
		const fold = w.children.length ? (collapsed.has(w.key) ? "▸" : "▾") : " ";
		const here = w.session && w.session === current ? c("1;35", "▌") : " ";
		const diff = w.diff && (w.diff.add || w.diff.del) ? c("32", "+" + w.diff.add) + c("31", "−" + w.diff.del) : "";
		const rightText = sidebar ? [counts].filter(Boolean).join(" ") : [counts, diff, c("90", age(w.updated).padStart(4))].filter(Boolean).join(" ");
		const name = w.session ? label(w) : c("90", label(w));
		const l = `${here}${" ".repeat(Math.max(0, r.depth - 1) * (sidebar ? 1 : 2))}${fold}${icon} ${name}`;
		const room = width - visibleWidth(rightText) - 1;
		return truncateToWidth(l, Math.max(6, room), "…", true) + " " + rightText;
	};
	const agentText = (n: Node) => {
		const a = attention(n);
		const flag = a === "needs" ? c("1;31", " !") : a === "blocked" ? c("31", " ⊘") : n.orphan ? c("35", " orphan") : "";
		return `${c(STATE_COLOR[n.state]!, ICON[n.state])} ${n.title.replace(/\s+/g, " ")}${flag}`;
	};
	const treeKey = (r: Row) => r.node ? "tree:session:" + r.node.id : "tree:project:" + r.label;
	const selectedTree = () => agents.find(r => treeKey(r) === selTree);
	const treeLine = (r: Row): string => {
		const badge = r.needs ? c("1;31", ` !${r.needs}`) : r.urgency === "blocked" ? c("31", " ⊘") : r.urgency === "orphan" ? c("35", " orphan") : "";
		if (!r.node) return c("1", `${collapsed.has(treeKey(r)) ? "▸" : "▾"}`) + badge + c("1", ` ${r.label}`) + c("90", ` ${r.count}`);
		const n = r.node;
		const children = (r.count ?? 1) > 1;
		const fold = children ? (collapsed.has(treeKey(r)) ? "▸" : "▾") : " ";
		const parent = n.parent && nodes.get(n.parent)?.project !== n.project ? nodes.get(n.parent) : undefined;
		const origin = parent ? c("90", ` ↖${parent.project}`) : "";
		return `${" ".repeat(r.depth)}${fold}${c(STATE_COLOR[n.state]!, ICON[n.state])}${badge}${origin} ${n.title.replace(/\s+/g, " ")}`;
	};
	const rightLine = (r: Right, width: number, w: Workspace): string => {
		if (r.kind === "window") {
			const agent = r.win.panes.find(p => p.agent)?.agent;
			const what = agent ? agentText(agent) : r.win.panes.map(p => p.command + (p.path !== w.path ? " " + c("90", home(p.path)) : "")).join(c("90", " │ "));
			const l = `${r.win.active ? c("1", "*") : " "}${c("1", String(r.win.index))} ${c("90", r.win.name.padEnd(10).slice(0, 10))} ${what}`;
			return truncateToWidth(l, width - 5, "…", true) + c("90", agent ? age(agent.updated).padStart(5) : "");
		}
		const l = `  ${"  ".repeat(r.depth)}${agentText(r.n)}${c("90", r.n.state === "resumable" ? "  ↵ resume" : r.n.pid && !r.n.pane ? "  headless" : "")}`;
		return truncateToWidth(l, width - 5, "…", true) + c("90", age(r.n.updated).padStart(5));
	};

	const previewFor = (height: number, width: number): string[] => {
		const w = selectedWs();
		let pane: string | undefined, n: Node | undefined, head: string[] = [];
		if (view === "tree") n = selectedTree()?.node;
		else if (view === "agents") n = nodes.get(selAgent ?? "");
		else if (focus === "right" && right[selRight]) {
			const r = right[selRight]!;
			if (r.kind === "window") { const p = r.win.panes.find(p => p.active) ?? r.win.panes[0]; pane = p?.id; n = p?.agent; }
			else n = r.n;
		} else if (view === "workspaces" && w) {
			const win = w.windows.find(x => x.active) ?? w.windows[0];
			pane = win?.panes.find(p => p.active)?.id;
			if (!pane) n = w.agents[0]; // parked workspace: its latest agent's transcript
			head = [c("1", label(w)) + c("90", `  ${w.branch ?? ""}  ${home(w.path)}${w.parent ? "  ← " + label(spaces.get(w.parent) ?? w) : ""}`)];
		}
		if (n) head = [c("90", `${n.state}${n.pid ? " pid " + n.pid : ""}  ${n.model ?? ""}  ${home(n.cwd)}`) + (n.report ? c("33", `  [${n.report.tag}] ${n.report.body.replace(/\s+/g, " ")}`) : "")];
		pane ??= n?.pane && act.paneAlive(n.pane) ? n.pane : undefined;
		if (pass) pane = pass;
		if (pass) head = [c("1;30;43", " input → " + pass + " ") + c("90", "  esc returns to the dashboard")];
		const body = (pane && act.capturePane(pane, height)) || (n ? transcriptTail(n.file, height, width) : []);
		while (body.length && !body[body.length - 1]!.trim()) body.pop();
		const lines = [...head, ...body.slice(-(height - head.length))];
		return lines.slice(0, height).map(l => truncateToWidth(l, width));
	};

	function draw() {
		const width = W(), height = H();
		geometry = [];
		const hint = sidebar ? "? for help" : view !== "workspaces" ? "enter open  i send  z park  p prune  U prune idle  s views  / filter  ? help"
			: focus === "left" ? "enter open  l windows  n pi  c term  N branch  m merge  x close  p prune  U prune idle  s views  ? help"
			: "enter open  i send  z park  x kill window  h back  ? help";
		const footerText = pass ? "typing into " + pass + " — esc to return" : input ? (input.prompt ?? (input.kind === "filter" ? "/" : "> ")) + input.text + "█" : message || `${query ? "/" + query + "  " : ""}${hint}`;
		const footer = truncateToWidth(c("7", " " + footerText), width, "", true);
		if (help) {
			const text = sidebar ? SIDEBAR_HELP : HELP;
			out.write("\x1b[H\x1b[2J" + text.split("\n").slice(0, height - 1).map(l => truncateToWidth(l, width)).join("\r\n") + `\x1b[${height};1H` + footer);
			return;
		}
		const screen: string[] = [];
		const listHeight = sidebar ? height - 1 : height - 1 - Math.floor(height * preview / 100);
		const hl = (s: string, w: number, on: boolean, dim = false) => on ? `\x1b[48;5;${dim ? 236 : 238}m` + truncateToWidth(s.replace(/\x1b\[0m/g, `\x1b[0m\x1b[48;5;${dim ? 236 : 238}m`), w, "", true) + "\x1b[0m" : truncateToWidth(s, w, "", true);
		const window = <T,>(list: T[], at: number, h: number) => { const top = Math.max(0, Math.min(at - Math.floor(h / 2), list.length - h)); return { top, items: list.slice(top, top + h) }; };

		if (view !== "workspaces") {
			const at = Math.max(0, agents.findIndex(r => view === "tree" ? treeKey(r) === selTree : r.node?.id === selAgent));
			const { top, items } = window(agents, at, listHeight);
			items.forEach((r, i) => {
				const y = i + 1;
				const text = view === "tree" ? treeLine(r) : r.kind === "header" ? "  ".repeat(r.depth) + c("1", `${collapsed.has(r.key!) ? "▸" : "▾"} ${r.label}`) + c("90", ` ${r.count}`) : "  ".repeat(r.depth) + agentText(r.node!) + c("90", "  " + (workspaceFor(r.node) ? label(workspaceFor(r.node)!) : home(r.node!.cwd)) + "  " + age(r.node!.updated));
				screen.push(hl(sidebar ? truncateToWidth(text, width) : text, width, top + i === at));
				geometry.push({ y, x0: 0, x1: width, act: (dbl) => { if (view === "tree") selTree = treeKey(r); if (r.node) { if (sidebar) { selAgent = r.node.id; openAgent(r.node); } else { if (dbl && selAgent === r.node.id) openAgent(r.node); selAgent = r.node.id; } } else { toggle(view === "tree" ? treeKey(r) : r.key!); } },
					fold: view === "tree" && r.node && (r.count ?? 1) > 1 ? () => toggle(treeKey(r)) : undefined,
					foldX: view === "tree" ? r.node ? r.depth : 0 : undefined });
			});
			while (screen.length < listHeight) screen.push("");
		} else {
			const lw = sidebar ? width : Math.max(30, Math.floor(width * 0.42));
			const rw = width - lw - 1;
			const at = Math.max(0, left.findIndex(r => leftKey(r) === selLeft));
			const L = window(left, at, listHeight);
			const w = selectedWs();
			const R = window(right, selRight, listHeight);
			for (let i = 0; i < listHeight; i++) {
				const r = L.items[i];
				let line = r ? hl(leftLine(r, lw), lw, L.top + i === at, focus === "right") : " ".repeat(lw);
				if (r) {
					const idx = L.top + i;
					geometry.push({ y: i + 1, x0: 0, x1: lw, act: (dbl) => { const same = selLeft === leftKey(r); selLeft = leftKey(r); focus = "left"; buildRight(); if (r.kind === "project") toggle("project:" + r.project); else if (sidebar) { openLeft(); leaveSidebar(); } else if (dbl && same) openLeft(); void idx; },
						fold: r.kind === "ws" && r.w.children.length ? () => toggle(r.w.key) : undefined, foldX: r.kind === "ws" ? 1 + Math.max(0, r.depth - 1) * (sidebar ? 1 : 2) : 0 });
				}
				if (!sidebar) {
					const rr = R.items[i];
					line += c("90", "│") + (rr && w ? hl(rightLine(rr, rw, w), rw, R.top + i === selRight && focus === "right") : " ".repeat(rw));
					if (rr) { const idx = R.top + i; geometry.push({ y: i + 1, x0: lw + 1, x1: width, act: (dbl) => { const same = focus === "right" && selRight === idx; selRight = idx; focus = "right"; if (dbl && same) openRight(); } }); }
				}
				screen.push(line);
			}
		}
		if (!sidebar) {
			const ph = height - 1 - listHeight;
			screen.push(c("90", "─".repeat(width)), ...previewFor(ph - 1, width));
		}
		out.write("\x1b[H\x1b[2J" + screen.slice(0, height - 1).join("\x1b[0m\r\n") + `\x1b[0m\x1b[${height};1H` + footer);
	}

	const toggle = (k: string) => { collapsed.has(k) ? collapsed.delete(k) : collapsed.add(k); rebuild(); save(); };
	const toggleExpand = (r: Row) => { if ((r.count ?? 1) > 1) { collapsed.delete(treeKey(r)); rebuild(); save(); } };
	const done = () => { if (!sidebar) quit(); };
	const attempt = (f: () => string | void) => { try { const m = f(); if (m) { message = m; return false; } return true; } catch (e: any) { message = String(e?.stderr || e?.message || e).trim().split("\n")[0]!; return false; } };
	const openLeft = () => { const r = left.find(x => leftKey(x) === selLeft); if (!r) return; if (r.kind === "project") return toggle(leftKey(r)); if (attempt(() => act.openWorkspace(r.w))) { current = act.currentSession(); done(); } };
	const openAgent = (n: Node) => { const w = workspaceFor(n); if (attempt(() => act.open(n, w))) { done(); if (sidebar) leaveSidebar(); } };
	const openRight = () => { const r = right[selRight]; if (!r) return; if (r.kind === "window") { if (attempt(() => act.openWindow(r.win))) done(); } else openAgent(r.n); };
	const selectedAgent = (): Node | undefined => view === "tree" ? selectedTree()?.node : view === "agents" ? nodes.get(selAgent ?? "") : focus === "right" ? (right[selRight]?.kind === "agent" ? (right[selRight] as any).n : (right[selRight] as any)?.win?.panes.find((p: any) => p.agent)?.agent) : undefined;
	const selectedPane = (): string | undefined => { const r = right[selRight]; return focus === "right" && r?.kind === "window" ? (r.win.panes.find(p => p.active) ?? r.win.panes[0])?.id : undefined; };

	const suspend = (f: () => void) => {
		out.write("\x1b[?1000l\x1b[?1006l\x1b[?25h\x1b[?1049l");
		process.stdin.setRawMode(false);
		try { f(); } finally { process.stdin.setRawMode(true); out.write("\x1b[?1049h\x1b[?25l\x1b[?1000h\x1b[?1006h"); draw(); }
	};
	const quit = (status = 0) => { save(); out.write("\x1b[?1000l\x1b[?1006l\x1b[?25h\x1b[?1049l"); process.exit(status); };
	const runTool = (line: string) => { if (sidebar || line.startsWith("zed ")) act.run(line, "popup"); else suspend(() => act.run(line, "here")); };
	const wsTool = (kind: Parameters<typeof act.tool>[0]) => {
		const w = selectedWs();
		if (!w || w.key.startsWith("tmux:")) return;
		const parent = w.parent ? spaces.get(w.parent) : undefined;
		attempt(() => runTool(act.tool(kind, { id: w.key, cwd: w.path }, parent?.branch)));
	};

	// Sidebar navigation: moving the selection switches the tmux client there right away; the
	// keyboard stays here (the sidebar is a Ghostty split outside tmux) until enter/esc/click.
	const tm = (...a: string[]) => execFileSync("tmux", a, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
	const navSession = (d: number) => {
		// Skip parked workspaces; headings are selectable without switching the tmux client.
		const ws = left.filter(r => r.kind === "project" || !!r.w.session);
		if (!ws.length) return;
		const at = ws.findIndex(r => leftKey(r) === selLeft);
		const from = at >= 0 ? at : Math.max(0, ws.findIndex(r => r.kind === "ws" && r.w.session === current));
		const to = ws[Math.max(0, Math.min(ws.length - 1, from + d))]!;
		selLeft = leftKey(to);
		if (to.kind === "ws") try { const s = to.w.session!; act.switchTo(s); current = s; } catch (e) { message = String(e); }
	};
	const navWindow = (d: number) => {
		const session = current ?? act.currentSession();
		if (session) attempt(() => { tm("select-window", "-t", "=" + session + ":" + (d > 0 ? "+" : "-")); });
	};
	const navAgent = () => {
		const n = selectedAgent();
		if (n && act.paneAlive(n.pane)) attempt(() => act.open(n, workspaceFor(n)));
	};
	const leaveSidebar = () => { if (ghostty.inGhostty()) ghostty.focusMain(); };

	const handleKey = (data: string) => {
		const k = parseKey(data) ?? data;
		message = "";
		if (input) {
			if (input.kind === "confirm") { const i = input; input = undefined; if (k === "enter") i.then?.(""); }
			else if (k === "escape") { if (input.kind === "filter") query = ""; input = undefined; }
			else if (k === "enter") { const i = input; input = undefined; if (i.kind !== "filter") i.then?.(i.text); }
			else if (k === "backspace") input.text = input.text.slice(0, -1);
			else if (!data.startsWith("\x1b") && data >= " ") input.text += data;
			if (input?.kind === "filter") query = input.text;
			rebuild(); draw(); return;
		}
		if (help) { help = false; draw(); return; }
		if (sidebar && view === "workspaces") {
			const nav: Record<string, () => void> = {
				j: () => navSession(1), down: () => navSession(1), k: () => navSession(-1), up: () => navSession(-1),
				l: () => navWindow(1), right: () => navWindow(1), h: () => navWindow(-1), left: () => navWindow(-1),
				escape: leaveSidebar,
			};
			if (nav[k]) { nav[k]!(); draw(); return; }
			if (k === "enter") { const r = left.find(x => leftKey(x) === selLeft); if (r?.kind === "ws") openLeft(); leaveSidebar(); draw(); return; }
		} else if (sidebar && k === "escape") { leaveSidebar(); draw(); return; }
		const projectRow = view === "workspaces" && focus === "left" ? left.find(r => leftKey(r) === selLeft) : undefined;
		const project = view === "tree" ? (selectedTree()?.node ? undefined : selectedTree()?.label) : projectRow?.kind === "project" ? projectRow.project : undefined;
		const w = (view !== "workspaces" ? workspaceFor(selectedAgent()) : selectedWs()) ?? (project ? [...spaces.values()].find(x => x.main && x.project === project) : undefined);
		const freeRoot = view === "workspaces" && focus === "left" && selLeft === "project:tmux";
		const moveLeft = (d: number) => { const i = Math.max(0, Math.min(left.length - 1, Math.max(0, left.findIndex(r => leftKey(r) === selLeft)) + d)); selLeft = left[i] && leftKey(left[i]!); selRight = 0; buildRight(); };
		const moveAgent = (d: number) => { const list = agents; const i = Math.max(0, Math.min(list.length - 1, Math.max(0, list.findIndex(r => r.node?.id === selAgent)) + d)); const r = list[i]; if (r?.node) selAgent = r.node.id; else if (r) { const next = list[i + Math.sign(d)]; if (next?.node) selAgent = next.node.id; } };
		const move = (d: number) => {
			if (view === "tree") {
				const i = Math.max(0, Math.min(agents.length - 1, Math.max(0, agents.findIndex(r => treeKey(r) === selTree)) + d));
				selTree = agents[i] && treeKey(agents[i]!);
			} else if (view === "agents") moveAgent(d);
			else if (focus === "right") selRight = Math.max(0, Math.min(right.length - 1, selRight + d));
			else moveLeft(d);
			if (sidebar && view !== "workspaces") navAgent();
		};
		switch (k) {
			case "q": case "ctrl+c": return quit();
			case "escape": if (focus === "right") focus = "left"; else if (!sidebar) return quit(); break;
			case "?": help = true; break;
			case "j": case "down": move(1); break;
			case "k": case "up": move(-1); break;
			case "ctrl+d": case "pageDown": move(10); break;
			case "ctrl+u": case "pageUp": move(-10); break;
			case "g": case "home": move(-1e6); break;
			case "G": case "end": move(1e6); break;
			case "l": case "right":
				if (view === "tree") { const r = selectedTree(); if (r) toggleExpand(r); }
				else if (view === "workspaces" && !sidebar && focus === "left" && right.length) focus = "right";
				else if (focus === "left") { const r = left.find(x => leftKey(x) === selLeft); if (r) { collapsed.delete(leftKey(r)); rebuild(); } }
				break;
			case "h": case "left":
				if (view === "tree") {
					const r = selectedTree();
					if (r && !collapsed.has(treeKey(r)) && (!r.node || (r.count ?? 1) > 1)) toggle(treeKey(r));
					else if (r?.node?.parent && nodes.get(r.node.parent)?.project === r.node.project && agents.some(x => x.node?.id === r.node!.parent)) selTree = "tree:session:" + r.node.parent;
					else if (r?.node) selTree = "tree:project:" + r.node.project;
				}
				else if (focus === "right") focus = "left";
				else { const r = left.find(x => leftKey(x) === selLeft); if (r) { const k2 = leftKey(r); if ((r.kind === "project" || r.w.children.length) && !collapsed.has(k2)) { collapsed.add(k2); rebuild(); } else { const i = left.indexOf(r); const up = left.slice(0, i).reverse().find(x => x.kind === "project" || (r.kind === "ws" && x.kind === "ws" && x.depth < r.depth)); if (up) selLeft = leftKey(up); buildRight(); } } }
				break;
			case "space": if (view === "tree") { const r = selectedTree(); if (r && (!r.node || (r.count ?? 1) > 1)) toggle(treeKey(r)); } else if (focus === "left") { const r = left.find(x => leftKey(x) === selLeft); if (r) toggle(leftKey(r)); } break;
			case "s": case "tab": view = view === "workspaces" ? "agents" : view === "agents" ? "tree" : "workspaces"; focus = "left"; rebuild(); save(); break;
			case "/": input = { kind: "filter", text: query }; break;
			case "enter": if (view === "tree") { const r = selectedTree(); if (r?.node) openAgent(r.node); else if (r) toggle(treeKey(r)); } else if (view === "agents") { const n = nodes.get(selAgent ?? ""); if (n) openAgent(n); } else focus === "right" ? openRight() : openLeft(); break;
			case "i": {
				const n = selectedAgent();
				const pane = selectedPane() ?? (n?.pane && act.paneAlive(n.pane) ? n.pane : undefined) ?? (focus === "left" && w ? (w.windows.find(x => x.active) ?? w.windows[0])?.panes.find(p => p.active)?.id : undefined);
				if (pane) { pass = pane; passTimer = setInterval(draw, 250); break; }
				if (!n) { message = "select a window or agent (l)"; break; }
				input = { kind: "send", text: "", prompt: "send (no pane; via its board topic)> ", then: t => { message = act.send(n, t) ?? "sent"; } };
				break;
			}
			case "z": { const n = selectedAgent(); if (n) { message = act.park(n) ?? "parked"; setTimeout(refresh, 500); } break; }
			case "n": if (w || freeRoot) { if (attempt(() => w ? act.newWindow(w, "pi", "pi") : act.newFreeSession("pi"))) { done(); if (sidebar) { leaveSidebar(); void refresh(); } } } break;
			case "c": if (w || freeRoot) { if (attempt(() => w ? act.newWindow(w) : act.newFreeSession())) { done(); if (sidebar) { leaveSidebar(); void refresh(); } } } break;
			case "N": if (w && !w.key.startsWith("tmux:")) input = { kind: "branch", text: "", prompt: sidebar ? "new branch: " : `new worktree off ${w.branch ?? label(w)}: `, then: name => {
				if (!name.trim()) return;
				const q = (x: string) => "'" + x.replace(/'/g, "'\\''") + "'";
				runTool(`cd ${q(w.path)} && workmux add ${q(name.trim())} --session -C ${w.branch ? "--base " + q(w.branch) : ""}`);
				if (sidebar) leaveSidebar();
				void refresh();
			} }; break;
			case "m": if (w && w.parent) { const p = spaces.get(w.parent); input = { kind: "confirm", text: "", prompt: `merge ${label(w)} into ${p?.branch ?? label(p!)}? [Enter to confirm] `, then: () => { const q = (x: string) => "'" + x.replace(/'/g, "'\\''") + "'"; runTool(`cd ${q(w.path)} && workmux merge ${p?.branch ? "--into " + q(p.branch) : ""}; printf 'press enter '; read -r _`); void refresh(); } }; } break;
			case "x": {
				const r = focus === "right" && view === "workspaces" ? right[selRight] : undefined;
				const n = view !== "workspaces" ? selectedAgent() : r?.kind === "agent" ? r.n : undefined;
				const active = w?.session ? (() => { try { return Number(tm("display-message", "-p", "-t", "=" + w.session + ":", "#{window_index}")); } catch { return undefined; } })() : undefined;
				const win = r?.kind === "window" ? r.win : n ? w?.windows.find(win => win.panes.some(p => p.agent?.id === n.id || p.id === n.pane)) : w?.windows.find(win => win.index === active);
				if (win) input = { kind: "confirm", text: "", prompt: sidebar ? `kill window ${win.index}? [Enter to confirm] ` : `kill window ${win.index} (${win.name})? [Enter to confirm] `, then: () => { attempt(() => act.killWindow(win)); void refresh(); } };
				else message = "no window selected";
				break;
			}
			case "p": {
				if (!w || w.main || w.key.startsWith("tmux:")) { message = "select a worktree"; break; }
				const candidate = unattachedWorktrees(spaces).find(t => t.path === w.path);
				if (!candidate) { message = "worktree has an attached window or live agent"; break; }
				input = { kind: "confirm", text: "", prompt: `remove worktree ${label(w)}? (clean only; branch stays) [Enter] `, then: () => {
					attempt(() => {
						if (!unattachedWorktrees(spaces).some(t => t.path === candidate.path)) return "worktree now attached";
						return `worktree ${act.pruneWorktree(candidate.root, candidate.path)}`;
					});
					void refresh();
				} };
				break;
			}
			case "U": {
				const candidates = unattachedWorktrees(spaces);
				if (!candidates.length) { message = "no unattached worktrees in dashboard projects"; break; }
				input = { kind: "confirm", text: "", prompt: `remove ${candidates.length} unattached worktree(s)? (dirty/busy skipped; branches stay) [Enter] `, then: () => {
					const counts = { removed: 0, dirty: 0, busy: 0, skipped: 0, errors: 0 };
					for (const candidate of candidates) {
						try {
							if (!unattachedWorktrees(spaces).some(t => t.path === candidate.path)) { counts.skipped++; continue; }
							counts[act.pruneWorktree(candidate.root, candidate.path)]++;
						} catch { counts.errors++; }
					}
					message = Object.entries(counts).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(", ");
					void refresh();
				} };
				break;
			}
			case "X":
				if (w?.session) input = { kind: "confirm", text: "", prompt: sidebar ? `close ${w.session}? [Enter to confirm] ` : `close ${w.session} (worktree stays)? [Enter to confirm] `, then: () => { attempt(() => act.killSession(w)); void refresh(); } };
				else message = "no session selected";
				break;
			case "d": wsTool("diff"); break;
			case "w": wsTool("wip"); break;
			case "y": wsTool("files"); break;
			case "e": wsTool("edit"); break;
			case "o": wsTool("zed"); break;
			case "f": if (w && !w.key.startsWith("tmux:")) { message = "collecting files…"; draw(); void import("./files").then(async f => {
				const m = await f.mirror(w.path, w.agents, w.key);
				message = m.count ? "" : "no files found";
				if (m.count) runTool("cd " + JSON.stringify(m.dir) + " && yazi");
				draw();
			}).catch(e => { message = String(e); draw(); }); } break;
			case "P": input = { kind: "branch", text: "", prompt: "add project (path or zoxide query): ", then: t => {
				const path = resolveProject(t);
				if (!path) { message = "no such project: " + t; return; }
				const p = loadProjects();
				p.hidden = p.hidden.filter(x => x !== path);
				if (!p.pinned.includes(path)) p.pinned.push(path);
				saveProjects(p); message = "added " + home(path); void refresh();
			} }; break;
			case "D": {
				const r = left.find(x => leftKey(x) === selLeft);
				const main = r?.kind === "project" ? [...spaces.values()].find(x => x.main && x.project === r.project) : r?.kind === "ws" ? [...spaces.values()].find(x => x.main && x.project === r.w.project) : undefined;
				if (!main) break;
				input = { kind: "confirm", text: "", prompt: `remove ${main.project} from the dashboard (until P adds it back)? [y/N] `, then: a => {
					if (a.trim() !== "y") return;
					const p = loadProjects();
					p.pinned = p.pinned.filter(x => x !== main.path);
					if (!p.hidden.includes(main.path)) p.hidden.push(main.path);
					saveProjects(p); void refresh();
				} };
				break;
			}
			case "+": case "=": preview = Math.min(80, preview + 5); break;
			case "-": preview = Math.max(15, preview - 5); break;
			case "r": void refresh(); break;
			case "R": if (sidebar) quit(75); break; // bin/ab relaunches the sidebar in this split
			default:
				if (/^[1-9]$/.test(k) && w) { const win = w.windows.find(x => x.index === Number(k)); if (win && attempt(() => act.openWindow(win))) done(); }
		}
		draw();
	};

	let lastClick = { y: -1, x: -1, at: 0 };
	const handleMouse = (data: string) => {
		const m = /^\x1b\[<(\d+);(\d+);(\d+)([Mm])$/.exec(data);
		if (!m || m[4] !== "M") return;
		const b = Number(m[1]), x = Number(m[2]) - 1, y = Number(m[3]);
		message = "";
		if ((b === 64 || b === 65) && sidebar && view === "workspaces") { navSession(b === 64 ? -1 : 1); draw(); return; }
		if (b === 64 || b === 65) {
			const d = b === 64 ? -3 : 3;
			const inRight = !sidebar && view === "workspaces" && geometry.some(g => g.y === y && g.x0 > 0 && x >= g.x0);
			if (inRight) selRight = Math.max(0, Math.min(right.length - 1, selRight + d));
			else if (view !== "workspaces") { for (let i = 0; i < Math.abs(d); i++) handleKey(d > 0 ? "j" : "k"); return; }
			else { const i = Math.max(0, Math.min(left.length - 1, Math.max(0, left.findIndex(r => leftKey(r) === selLeft)) + d)); selLeft = left[i] && leftKey(left[i]!); buildRight(); }
			draw(); return;
		}
		if (b !== 0) return;
		const g = geometry.find(g => g.y === y && x >= g.x0 && x < g.x1);
		const dbl = Date.now() - lastClick.at < 400 && lastClick.y === y;
		lastClick = { y, x, at: Date.now() };
		if (!g) return;
		if (g.fold && g.foldX !== undefined && Math.abs(x - g.foldX) <= 1) g.fold();
		else g.act(dbl || true);
		draw();
	};

	process.stdin.setRawMode(true);
	process.stdin.setEncoding("utf8");
	process.stdin.on("data", (chunk: string) => {
		if (pass) {
			if (chunk === "\x1b") { pass = undefined; clearInterval(passTimer); draw(); return; }
			if (chunk.startsWith("\x1b[<")) return; // mouse
			try { execFileSync("tmux", ["send-keys", "-t", pass, "-H", ...[...Buffer.from(chunk, "utf8")].map(b => b.toString(16))]); }
			catch { pass = undefined; clearInterval(passTimer); message = "pane is gone"; }
			setTimeout(draw, 60);
			return;
		}
		for (const k of keys(chunk)) k.startsWith("\x1b[<") ? handleMouse(k) : handleKey(k);
	});
	let widthTimer: ReturnType<typeof setTimeout> | undefined, sizing = false;
	out.on("resize", () => {
		draw();
		// Remember the width you drag the sidebar to.
		if (sidebar && ghostty.inGhostty() && !sizing) { clearTimeout(widthTimer); widthTimer = setTimeout(() => { saved.sidebarWidth = W(); save(); }, 800); }
	});
	if (sidebar && ghostty.inGhostty()) {
		out.write(`\x1b]2;${ghostty.TITLE}\x07`);
		// A new split starts at half the window: step the divider toward the remembered width,
		// re-estimating points per column from each step.
		sizing = true;
		void (async () => {
			const target = saved.sidebarWidth ?? 38;
			let per = 8;
			for (let i = 0; i < 6; i++) {
				await new Promise(r => setTimeout(r, 400));
				const diff = target - W();
				if (Math.abs(diff) <= 1) break;
				const before = W();
				ghostty.resizeSidebar(diff * per);
				await new Promise(r => setTimeout(r, 400));
				const moved = W() - before;
				if (moved) per = Math.min(40, Math.max(2, Math.abs(per * diff / moved)));
			}
			setTimeout(() => { sizing = false; }, 1000);
		})();
	}
	out.write("\x1b[?1049h\x1b[?25l\x1b[?1000h\x1b[?1006h");
	message = "loading…";
	draw();
	await refresh();
	if (message === "loading…") { message = ""; draw(); }
	setInterval(refresh, sidebar ? 4000 : 2500);
}

/** Split a stdin chunk into single keys: several arrive together when typed fast or sent by tmux. */
function keys(chunk: string): string[] {
	const out: string[] = [];
	const chars = Array.from(chunk);
	for (let i = 0; i < chars.length; i++) {
		if (chars[i] === "\x1b" && (chars[i + 1] === "[" || chars[i + 1] === "O")) {
			let j = i + 2;
			while (j < chars.length && !/[@-~]/.test(chars[j]!) || (j < chars.length && chars[j] === "<" && j === i + 2)) j++;
			out.push(chars.slice(i, j + 1).join(""));
			i = j;
		} else if (chars[i] === "\x1b" && chars[i + 1] && chars[i + 1] !== "\x1b") { out.push(chars[i]! + chars[i + 1]); i++; }
		else out.push(chars[i]!);
	}
	return out;
}

const SIDEBAR_HELP = `ab tree · sidebar

workspaces · live tmux
 j/k ↑/↓  switch session
 h/l ←/→  prev/next window
 enter   open  esc focus tmux

s/tab  workspace/status/tree
 j/k    follow live agent
 h/l    fold/expand in tree
 enter  open or resume agent

n/c    new pi / terminal
N/m    worktree / merge parent
x/X    close window / session
p/U    prune one / all idle
i/z    type/send / park agent
/      filter       space fold
P/D    add / hide project
r/R    refresh / reload   q quit
! needs you  ⊘ blocked
● working  ○ idle  · resumable
□ open     ◇ parked  ▌ here`;
const HELP = `ab tree — workspaces (worktrees ↔ tmux sessions), their windows, their agents

  j/k ↑/↓  move      ctrl-d/u  page      g/G  top/bottom      mouse: click, wheel
  enter    open the workspace (its tmux session, created if parked) / the window / agent
  l/→      into the workspace's windows and agents   h/←  back, fold, or up a level
  space    fold      1-9  jump to that window of the selected workspace
  s tab    cycle workspaces → agents by status → sessions by project/parentage   / filter

  workspace   n new pi   c new terminal   N new worktree off it (workmux, session mode)
              m merge into its parent (workmux merge)   x close its active window   X close its tmux session
              p prune selected unattached worktree   U prune all unattached worktrees in dashboard projects
              pruning skips dirty or busy worktrees, keeps branches, and never removes the main checkout
              d review vs parent in tuicr   w review uncommitted   f its agents' files in yazi
              y yazi   e nvim   o zed
  project    n/c/N use its main checkout (workspace view or project session tree)
  tmux       always shown in workspace view; n/c on its heading create free sessions in ~
           sessions with a matching project session/pane path appear under that project
  i        type into the selected window/agent's pane from here (esc returns); an agent
           without a pane (headless) gets a one-line board message instead
  window   x kill it           agent   z park (stop the process; the session stays resumable)   enter resume
  P        add a project (path or zoxide query)   D remove the selected project from the list

  sidebar  s cycles workspaces / status / project sessions; j/k ↑/↓ visits headings and live sessions
           h/l ←/→: windows in workspace view, fold/expand in session tree; enter opens/resumes
           x closes the active window (or selected agent's window); X closes its session
           p prunes selected unattached worktree; U prunes all unattached worktrees in dashboard projects
           n new pi   c new terminal   N new worktree (selected workspace/agent's workspace)
           it's a Ghostty split (ab tree sidebar opens one); drag to resize, width is kept
  tmux     prefix ( / ) back/forward through visited windows   prefix a new pi window

  ! needs you ⊘ blocked ● working ○ idle · resumable   workspaces: □ open ◇ parked (no tmux session)   ▌ you are here
  +/- preview size   r refresh data   R reload sidebar code   q quit`;
