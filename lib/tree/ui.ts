// A thread sidebar (also usable full-screen). Pointing/scrolling never attaches;
// click or Enter switches the one bound main zmx client.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, basename } from "node:path";
import { parseKey, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { ThreadRow } from "../thread";
import { label, visibleRows, workspaces, type TreeMode } from "./workspaces";
import * as act from "./actions";
import * as ghostty from "./ghostty";

const STATE = join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"), "ab-tree", "ui.json");
interface Saved { mode?: TreeMode; collapsed?: string[]; sidebarWidth?: number; shown?: Record<string, string> }
interface Hit { y: number; x0: number; x1: number; id?: string; action?: act.Action | "fold" | "mode" }
const names: Record<act.Action, string> = { new: "new", worktree: "new in worktree", fork: "fork", merge: "merge", archive: "archive", abandon: "abandon", children: "abandon all children" };
const color = (code: string, s: string) => `\x1b[${code}m${s}\x1b[0m`;

export async function ui(opts: { sidebar?: boolean; query?: string }) {
	if (!process.stdin.isTTY) throw new Error("ab tree ui needs a terminal");
	const saved: Saved = (() => { try { return JSON.parse(readFileSync(STATE, "utf8")); } catch { return {}; } })();
	const binding = process.env.AB_TREE_MAIN_TERMINAL;
	let shown = process.env.AB_TREE_SHOWN ?? (binding && saved.shown?.[binding]);
	let mode: TreeMode = saved.mode === "merge" ? "merge" : "spawn";
	const collapsed = new Set(saved.collapsed ?? []);
	let rows: ThreadRow[] = [], visible: ThreadRow[] = [];
	let selected: string | undefined, hovered: string | undefined, scroll = 0;
	let hits: Hit[] = [], message = "loading…", busy = false, help = false, follow = true;
	let input: { prompt: string; text: string; submit: (text: string) => void } | undefined;
	let refreshing = false;
	const out = process.stdout;
	const width = () => out.columns || 40, height = () => out.rows || 24;
	const save = () => {
		if (binding) {
			saved.shown ??= {};
			if (shown) saved.shown[binding] = shown; else delete saved.shown[binding];
		}
		mkdirSync(dirname(STATE), { recursive: true });
		writeFileSync(STATE, JSON.stringify({ ...saved, mode, collapsed: [...collapsed] }));
	};
	const rebuild = () => {
		visible = visibleRows(rows, query, collapsed);
		if (!visible.some(r => r.thread.id === selected)) selected = visible[0]?.thread.id;
		if (!visible.some(r => r.thread.id === hovered)) hovered = undefined;
	};
	let query = opts.query ?? "";
	const refresh = async () => {
		if (refreshing) return;
		refreshing = true;
		try {
			rows = await workspaces(mode);
			if (shown && !rows.some(r => r.thread.id + ".agent" === shown)) { shown = undefined; save(); }
			rebuild();
			if (message === "loading…") message = "";
		} catch (e) { message = String(e); }
		finally { refreshing = false; draw(); }
	};
	const perform = (body: () => Promise<void>) => {
		if (busy) return;
		busy = true; message = "working…"; draw();
		void body().catch(e => { message = String(e); }).finally(() => { busy = false; void refresh(); });
	};
	const attach = (id: string) => perform(async () => { shown = await act.open(id, shown); save(); message = ""; });
	const ask = (prompt: string, submit: (text: string) => void) => { input = { prompt, text: "", submit }; draw(); };
	const action = (kind: act.Action, id?: string) => {
		if (busy) return;
		const row = rows.find(r => r.thread.id === id);
		if (id && !row) return;
		if (kind === "new" || kind === "fork" || kind === "worktree") {
			const create = (name?: string) => perform(async () => {
				const thread = await act.create(kind, row?.thread, name);
				selected = thread.id;
				shown = await act.open(thread.id, shown);
				save(); message = "";
			});
			if (kind === "worktree") ask("Worktree branch: ", name => { if (name.trim()) create(name.trim()); });
			else create();
		} else if (row) {
			const verb = kind === "children" ? "abandon all children in the " + mode + " tree of" : kind;
			ask(`${verb} ${label(row)}? [y/N] `, answer => {
				if (answer !== "y") { message = "cancelled"; return; }
				perform(async () => {
					const closed = await act.retire(kind, row.thread, rows);
					if (shown && closed.some(id => id + ".agent" === shown)) shown = undefined;
					save(); message = "retired " + closed.length + " thread(s)";
				});
			});
		}
	};
	const toggleMode = () => { mode = mode === "spawn" ? "merge" : "spawn"; hovered = undefined; scroll = 0; follow = true; save(); void refresh(); };
	const fold = (id: string) => { collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id); save(); rebuild(); draw(); };
	function draw() {
		const w = width(), h = height();
		hits = [];
		const screen: string[] = [];
		const put = (text: string) => screen.push(truncateToWidth(text, w, "", true));
		if (help) {
			for (const line of HELP.split("\n").slice(0, h - 2)) put(line);
		} else {
			put(color("1", `threads · ${mode}`) + color("90", "  tab: other tree"));
			hits.push({ y: 0, x0: 0, x1: w, action: "mode" });
			const extra = hovered ? 4 : 0;
			const capacity = Math.max(1, h - 3 - extra);
			if (follow) {
				const index = visible.findIndex(r => r.thread.id === selected);
				if (index < scroll) scroll = Math.max(0, index);
				if (index >= scroll + capacity) scroll = index - capacity + 1;
				follow = false;
			}
			scroll = Math.max(0, Math.min(scroll, Math.max(0, visible.length - capacity)));
			for (const row of visible.slice(scroll)) {
				if (screen.length >= h - 2) break;
				const id = row.thread.id, t = row.thread;
				const children = rows.some(r => r.treeParent === id);
				const indent = " ".repeat(Math.min(row.depth, Math.max(0, w - 10)));
				const marker = shown === id + ".agent" ? "▌" : " ";
				const status = t.blocked || row.report?.tag === "blocked" ? "⊘" : row.report?.tag === "needs-input" ? "!" : row.state === "working" ? "●" : row.state === "idle" ? "○" : "·";
				let text = `${marker}${indent}${children ? collapsed.has(id) ? "▸" : "▾" : " "}${status} ${label(row)}`;
				if (row.depth === 0) text += color("90", "  " + basename(t.project));
				if (t.ownership === "guest") text += color("90", " guest");
				if (t.blocked) text += color("31", " blocked");
				if (id === selected) text = color("7", text);
				const y = screen.length;
				put(text);
				hits.push({ y, x0: 0, x1: w, id });
				if (children) hits.push({ y, x0: 1 + indent.length, x1: 2 + indent.length, id, action: "fold" });
				if (id !== hovered || input || busy) continue;
				const actions: act.Action[] = ["new", "worktree", "fork", "merge", "archive", "abandon"];
				if (children) actions.push("children");
				let line = "", x = 0;
				for (const a of actions) {
					const button = "[" + names[a] + "]";
					if (x && x + button.length > w) { put(color("1;36", line)); line = ""; x = 0; }
					if (screen.length >= h - 2) break;
					const displayed = truncateToWidth(button, w);
					hits.push({ y: screen.length, x0: x, x1: x + visibleWidth(displayed), id, action: a });
					line += displayed + " "; x += visibleWidth(displayed) + 1;
				}
				if (line && screen.length < h - 2) put(color("1;36", line));
			}
			if (!visible.length) put("No threads. n: new  N: worktree");
		}
		while (screen.length < h - 2) put("");
		const selectedRow = rows.find(r => r.thread.id === (hovered ?? selected));
		put(color("90", selectedRow?.thread.blocked?.reason ?? selectedRow?.thread.cwd ?? query));
		put(color("7", input ? input.prompt + input.text + "█" : message || "/ filter  enter open  ? help"));
		out.write("\x1b[H" + screen.join("\r\n") + "\x1b[J");
	}
	const leave = (code = 0) => { save(); out.write("\x1b[?1003l\x1b[?1006l\x1b[?25h\x1b[?1049l"); process.stdin.setRawMode(false); process.exit(code); };
	const key = (data: string) => {
		const k = parseKey(data);
		if (input) {
			if (k === "escape") input = undefined;
			else if (k === "enter") { const pending = input; input = undefined; pending.submit(pending.text); }
			else if (k === "backspace") input.text = Array.from(input.text).slice(0, -1).join("");
			else if (!data.startsWith("\x1b") && data >= " ") input.text += data;
			draw(); return;
		}
		if (k === "ctrl+c" || k === "q") return leave();
		if (k === "?") { help = !help; draw(); return; }
		if (help) { if (k === "escape") help = false; draw(); return; }
		if (k === "escape") { try { ghostty.focusMain(); } catch (e) { message = String(e); } }
		else if (k === "tab" || k === "s") toggleMode();
		else if (k === "r") void refresh();
		else if (k === "R") leave(75);
		else if (k === "/") ask("Filter: ", text => { query = text; scroll = 0; rebuild(); });
		else if (["up", "k", "down", "j", "g", "G"].includes(k ?? "")) {
			const i = visible.findIndex(r => r.thread.id === selected);
			const next = k === "g" ? 0 : k === "G" ? visible.length - 1 : i + (k === "up" || k === "k" ? -1 : 1);
			selected = visible[Math.max(0, Math.min(visible.length - 1, next))]?.thread.id;
			hovered = undefined; follow = true;
		} else if (k === "space" || k === "left" || k === "h" || k === "right" || k === "l") { if (selected) fold(selected); }
		else if (k === "enter") { if (selected) attach(selected); }
		else {
			const a: Record<string, act.Action> = { n: "new", N: "worktree", f: "fork", m: "merge", a: "archive", x: "abandon", X: "children" };
			if (k && a[k]) action(a[k]!, selected);
		}
		draw();
	};
	const mouse = (data: string) => {
		const m = /^\x1b\[<(\d+);(\d+);(\d+)([Mm])$/.exec(data);
		if (!m) return;
		const b = Number(m[1]), x = Number(m[2]) - 1, y = Number(m[3]) - 1;
		if (input || help) return;
		if (b === 64 || b === 65) { scroll += b === 64 ? -3 : 3; follow = false; hovered = undefined; draw(); return; }
		const hit = [...hits].reverse().find(g => g.y === y && x >= g.x0 && x < g.x1);
		if (b & 32) { if (hovered !== hit?.id) { hovered = hit?.id; draw(); } return; }
		if (b !== 0 || m[4] !== "M" || !hit) return;
		if (hit.action === "mode") toggleMode();
		else if (hit.action === "fold" && hit.id) fold(hit.id);
		else if (hit.action) action(hit.action as act.Action, hit.id);
		else if (hit.id) { selected = hit.id; attach(hit.id); }
		draw();
	};
	process.stdin.setRawMode(true);
	process.stdin.setEncoding("utf8");
	process.stdin.resume();
	let pending = "";
	process.stdin.on("data", (chunk: string) => {
		pending += chunk;
		while (pending) {
			if (pending.startsWith("\x1b[<") && !/[Mm]/.test(pending)) break;
			const token = pending.match(/^\x1b\[<\d+;\d+;\d+[Mm]|^\x1b(?:\[[0-9;]*[A-Za-z~]|O[A-Za-z])|^./su)?.[0];
			if (!token) break;
			pending = pending.slice(token.length);
			token.startsWith("\x1b[<") ? mouse(token) : key(token);
		}
	});
	out.on("resize", () => { draw(); });
	process.on("SIGTERM", () => leave());
	out.write("\x1b[?1049h\x1b[?25l\x1b[?1003h\x1b[?1006h");
	if (opts.sidebar && ghostty.inGhostty()) {
		out.write(`\x1b]2;${ghostty.sidebarTitle()}\x07`);
		let sizing = true;
		out.on("resize", () => { if (!sizing) { saved.sidebarWidth = width(); save(); } });
		void (async () => {
			let per = 8;
			for (let i = 0; i < 5; i++) {
				await new Promise(r => setTimeout(r, 400));
				const diff = (saved.sidebarWidth ?? 40) - width();
				if (Math.abs(diff) <= 1) break;
				const before = width();
				try { ghostty.resizeSidebar(diff * per); } catch (e) { message = String(e); break; }
				await new Promise(r => setTimeout(r, 400));
				const moved = width() - before;
				if (moved) per = Math.min(40, Math.max(2, Math.abs(per * diff / moved)));
			}
			sizing = false;
		})();
	}
	draw();
	await refresh();
	setInterval(refresh, 3000);
}

const HELP = `Work in threads
tab/s   spawn / merge tree
j/k ↑/↓ select without opening
enter   attach in main split
click   attach; fold arrow folds
wheel   scroll without selecting
hover   new / worktree / fork /
        merge / archive / abandon
X       abandon children in this tree
n/N     new here / new worktree
f       fork here
m/a/x   merge / archive / abandon
/       filter (empty clears)
space   fold or expand
esc     focus bound main split
r/R     refresh / reload
q       close sidebar, keep threads

merge and archive retire recursively.
abandon discards without merging.
Destructive actions ask [y/N].
▌ shown  ● working  ○ idle
! needs input  ⊘ blocked  · exited`;
