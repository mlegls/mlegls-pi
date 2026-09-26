// ab tree's TUI: one list of session rows (lib/tree/view.ts) with actions on the selected node,
// rendered two ways. The dashboard is full-screen with a live preview and closes after a jump;
// the sidebar is a narrow persistent list that runs tools in tmux popups. UI state (mode,
// folds, preview size) persists in ~/.local/state/ab-tree/ui.json.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parseKey, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { graph, type Node } from "./graph";
import { age, attention, ICON, rows, type Mode, type Row } from "./view";
import * as act from "./actions";

const STATE = join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"), "ab-tree", "ui.json");
interface Saved { mode: Mode; sidebarMode: Mode; collapsed: string[]; preview: number }

export async function ui(opts: { sidebar?: boolean; query?: string }) {
	const saved: Saved = { mode: "tree", sidebarMode: "projects", collapsed: [], preview: 55, ...(() => { try { return JSON.parse(readFileSync(STATE, "utf8")); } catch { return {}; } })() };
	const sidebar = !!opts.sidebar;
	let mode: Mode = sidebar ? saved.sidebarMode : saved.mode;
	const collapsed = new Set(saved.collapsed);
	let preview = saved.preview;
	let query = opts.query ?? "";
	let input: { kind: "filter" | "send"; text: string } | undefined;
	let nodes = new Map<string, Node>();
	let list: Row[] = [];
	let selected: string | undefined; // node id or "h:<label>"
	let message = "";
	let all = false;
	let help = false;

	const save = () => {
		mkdirSync(dirname(STATE), { recursive: true });
		writeFileSync(STATE, JSON.stringify({ ...saved, [sidebar ? "sidebarMode" : "mode"]: mode, collapsed: [...collapsed], preview }));
	};
	const key = (r: Row) => r.node ? r.node.id : "h:" + r.label;
	const foldKey = (r: Row) => r.node ? r.node.id : (mode === "status" ? "status:" : "project:") + r.label;
	const index = () => Math.max(0, list.findIndex(r => key(r) === selected));
	const current = () => list[index()];
	const rebuild = () => {
		list = rows(nodes, mode, { query, all, collapsed });
		if (!list.some(r => key(r) === selected)) selected = list.find(r => r.node)?.node!.id ?? (list[0] && key(list[0]));
	};

	let refreshing = false, lastPaseo = 0;
	const refresh = async () => {
		if (refreshing) return;
		refreshing = true;
		try {
			const paseo = Date.now() - lastPaseo > 30_000;
			nodes = await graph({ paseo });
			if (paseo) lastPaseo = Date.now();
			rebuild();
			draw();
		} finally { refreshing = false; }
	};

	const out = process.stdout;
	const color = (code: string, s: string) => `\x1b[${code}m${s}\x1b[0m`;
	const stateColor: Record<string, string> = { working: "32", idle: "33", live: "36", parked: "34", ended: "90", gone: "90" };

	const nodeLine = (r: Row, width: number): string => {
		const n = r.node!;
		const att = attention(n);
		const flag = att === "needs" ? color("1;31", " !") : att === "blocked" ? color("31", " ⊘") : att === "done" ? color("32", " ✓") : n.orphan ? color("35", " orphan") : "";
		const folded = n.children.length && collapsed.has(n.id) ? color("90", ` +${n.children.length}`) : "";
		const right = sidebar ? " " + age(n.updated) : `  ${age(n.updated).padStart(4)}  ${(n.model?.split("/").pop() ?? "").slice(0, 16).padEnd(16)}`;
		const indent = sidebar ? " ".repeat(Math.max(0, r.depth - 1)) : "  ".repeat(r.depth);
		const title = r.match === false ? color("90", n.title) : n.title;
		const left = `${indent}${color(stateColor[n.state]!, ICON[n.state])} ${title.replace(/\s+/g, " ")}`;
		const tail = flag + folded;
		const room = width - visibleWidth(right) - visibleWidth(tail) - 1;
		return truncateToWidth(left, Math.max(8, room), "…", true) + tail + color("90", right);
	};
	const headerLine = (r: Row, width: number): string => {
		const members = mode === "tree" ? [] : [];
		void members;
		const fold = collapsed.has(foldKey(r)) ? "▸" : "▾";
		return truncateToWidth(color("1", `${fold} ${r.label}`) + color("90", ` ${r.count}`), width);
	};

	const previewLines = (n: Node, height: number, width: number): string[] => {
		const meta = [
			color("1", n.title.replace(/\s+/g, " ")),
			color("90", `${n.state}${n.pid ? " pid " + n.pid : ""}${n.pane ? " " + n.pane : ""}  ${n.model ?? ""}  ${n.parentKind ? "via " + n.parentKind : "root"}  ${n.cwd.replace(homedir(), "~")}`),
			...(n.report ? [color("33", `[${n.report.tag}] ${n.report.body.replace(/\s+/g, " ")}`)] : []),
			"",
		];
		const body = act.capture(n, height) ?? (n.lastText ?? "").split("\n");
		const lines = [...meta, ...body.slice(-(height - meta.length))];
		return lines.slice(0, height).map(l => truncateToWidth(l, width));
	};

	function draw() {
		const width = out.columns || 80, height = out.rows || 24;
		const footerText = input ? (input.kind === "filter" ? "/" : "send> ") + input.text + "█"
			: message || (sidebar ? `[${mode}] ${query ? "/" + query + " " : ""}? help` : `[${mode}] ${query ? "/" + query + "  " : ""}enter open  z park  i send  d diff  w wip  f files  y yazi  e nvim  o zed  / filter  tab mode  ? help`);
		const footer = truncateToWidth(color("7", " " + footerText), width, "", true);
		let listHeight = height - 1;
		let pv: string[] = [];
		if (help) {
			const lines = HELP.split("\n");
			out.write("\x1b[H\x1b[2J" + lines.slice(0, height - 1).map(l => truncateToWidth(l, width)).join("\r\n") + "\x1b[" + height + ";1H" + footer);
			return;
		}
		const n = current()?.node;
		if (!sidebar && n) {
			const ph = Math.floor(height * preview / 100);
			listHeight = height - 1 - ph;
			pv = [color("90", "─".repeat(width)), ...previewLines(n, ph - 1, width)];
		}
		const at = index();
		const top = Math.max(0, Math.min(at - Math.floor(listHeight / 2), list.length - listHeight));
		const shown = list.slice(top, top + listHeight).map((r, i) => {
			const text = r.kind === "header" ? headerLine(r, width) : nodeLine(r, width);
			return top + i === at ? "\x1b[48;5;237m" + truncateToWidth(text.replace(/\x1b\[0m/g, "\x1b[0m\x1b[48;5;237m"), width, "", true) + "\x1b[0m" : text;
		});
		while (shown.length < listHeight) shown.push("");
		out.write("\x1b[H\x1b[2J" + [...shown, ...pv].slice(0, height - 1).join("\x1b[0m\r\n") + "\x1b[0m\x1b[" + height + ";1H" + footer);
	}

	const move = (d: number) => {
		if (!list.length) return;
		selected = key(list[Math.max(0, Math.min(list.length - 1, index() + d))]!);
	};
	const nodeRows = () => list.filter(r => r.node);

	const suspend = (f: () => void) => {
		out.write("\x1b[?25h\x1b[?1049l");
		process.stdin.setRawMode(false);
		try { f(); } finally {
			process.stdin.setRawMode(true);
			out.write("\x1b[?1049h\x1b[?25l");
			draw();
		}
	};
	const quit = () => {
		save();
		out.write("\x1b[?25h\x1b[?1049l");
		process.exit(0);
	};
	const tool = (kind: Parameters<typeof act.tool>[0]) => {
		const n = current()?.node;
		if (!n) return;
		try {
			const line = act.tool(kind, n);
			if (sidebar || line.startsWith("zed ")) act.run(line, "popup");
			else suspend(() => act.run(line, "here"));
		} catch (e) { message = String(e); }
	};

	const handle = (data: string) => {
		const k = parseKey(data) ?? data;
		message = "";
		if (input) {
			if (k === "escape") { if (input.kind === "filter") query = ""; input = undefined; }
			else if (k === "enter") {
				if (input.kind === "send") { const n = current()?.node; message = n ? act.send(n, input.text) ?? "sent" : ""; }
				input = undefined;
			} else if (k === "backspace") input.text = input.text.slice(0, -1);
			else if (data.length === 1 && data >= " ") input.text += data;
			else if (data.length > 1 && !data.startsWith("\x1b")) input.text += data; // paste
			if (input?.kind === "filter") query = input.text;
			rebuild(); draw(); return;
		}
		if (help) { help = false; draw(); return; }
		const r = current();
		switch (k) {
			case "q": case "escape": case "ctrl+c": return quit();
			case "?": help = true; break;
			case "j": case "down": move(1); break;
			case "k": case "up": move(-1); break;
			case "ctrl+d": case "pageDown": move(10); break;
			case "ctrl+u": case "pageUp": move(-10); break;
			case "g": case "home": selected = list[0] && key(list[0]); break;
			case "G": case "end": selected = list.length ? key(list[list.length - 1]!) : undefined; break;
			case "tab": mode = mode === "tree" ? "projects" : mode === "projects" ? "status" : "tree"; rebuild(); break;
			case "t": mode = "tree"; rebuild(); break;
			case "p": mode = "projects"; rebuild(); break;
			case "s": mode = "status"; rebuild(); break;
			case "a": all = !all; message = all ? "showing everything in the window" : "showing active and recent"; rebuild(); break;
			case "/": input = { kind: "filter", text: query }; break;
			case "h": case "left": if (r) { if (r.node && !(r.node.children.length && !collapsed.has(r.node.id))) { const parent = list.slice(0, index()).reverse().find(x => x.depth < r.depth); if (parent) selected = key(parent); } else collapsed.add(foldKey(r)); rebuild(); } break;
			case "l": case "right": if (r) { collapsed.delete(foldKey(r)); rebuild(); } break;
			case "space": if (r) { const f = foldKey(r); collapsed.has(f) ? collapsed.delete(f) : collapsed.add(f); rebuild(); } break;
			case "H": for (const x of list) if (x.kind === "header") collapsed.add(foldKey(x)); rebuild(); break;
			case "L": collapsed.clear(); rebuild(); break;
			case "enter": if (r?.node) { try { const m = act.open(r.node); if (m) message = m; else if (!sidebar) return quit(); } catch (e) { message = String(e); } } else if (r) { const f = foldKey(r); collapsed.has(f) ? collapsed.delete(f) : collapsed.add(f); rebuild(); } break;
			case "z": if (r?.node) { message = act.park(r.node) ?? "parked"; setTimeout(refresh, 500); } break;
			case "i": if (r?.node) input = { kind: "send", text: "" }; break;
			case "d": tool("diff"); break;
			case "w": tool("wip"); break;
			case "y": tool("files"); break;
			case "f": if (r?.node) { const n = r.node; message = "collecting files…"; draw(); void import("./files").then(async f => {
				const m = await f.mirror(n);
				message = m.count ? "" : "no files found for this session";
				if (!m.count) return draw();
				const line = "cd " + JSON.stringify(m.dir) + " && yazi";
				if (sidebar) act.run(line, "popup"); else suspend(() => act.run(line, "here"));
			}).catch(e => { message = String(e); draw(); }); } break;
			case "e": tool("edit"); break;
			case "o": tool("zed"); break;
			case "+": case "=": preview = Math.min(85, preview + 5); break;
			case "-": preview = Math.max(15, preview - 5); break;
			case "r": void refresh(); break;
			default:
				if (/^[1-9]$/.test(k)) { const target = nodeRows()[Number(k) - 1]; if (target) { selected = key(target); try { const m = act.open(target.node!); if (m) message = m; else if (!sidebar) return quit(); } catch (e) { message = String(e); } } }
		}
		draw();
	};

	process.stdin.setRawMode(true);
	process.stdin.setEncoding("utf8");
	process.stdin.on("data", (chunk: string) => { for (const k of keys(chunk)) handle(k); });
	out.on("resize", draw);
	out.write("\x1b[?1049h\x1b[?25l");
	message = "loading…";
	draw();
	await refresh();
	if (message === "loading…") { message = ""; draw(); }
	setInterval(refresh, 3000);
}

/** Split a stdin chunk into single keys: several arrive together when typed fast or sent by tmux. */
function keys(chunk: string): string[] {
	const out: string[] = [];
	const chars = Array.from(chunk);
	for (let i = 0; i < chars.length; i++) {
		if (chars[i] === "\x1b" && (chars[i + 1] === "[" || chars[i + 1] === "O")) {
			let j = i + 2;
			while (j < chars.length && !/[@-~]/.test(chars[j]!)) j++;
			out.push(chars.slice(i, j + 1).join(""));
			i = j;
		} else if (chars[i] === "\x1b" && chars[i + 1] && chars[i + 1] !== "\x1b") { out.push(chars[i]! + chars[i + 1]); i++; }
		else out.push(chars[i]!);
	}
	return out;
}

const HELP = `ab tree — sessions as a tree

  j/k ↑/↓  move          ctrl-d/u  page        g/G  top/bottom
  enter    open: focus its tmux pane, or reopen a parked session (pi --session)
  1-9      open the nth session
  h/l      fold/unfold (h on a leaf goes to its parent)   space toggle   H/L all
  tab      cycle tree → projects → status    t/p/s  pick one
  /        filter: key:value (state project model kind run orphan), fuzzy words, !negate
  a        toggle all sessions in the window vs active + recent

  z        park: stop the process, keep worktree and session (Paseo agents are archived)
  i        send a message to the agent (pasted into its pane, or via Paseo)
  d        review the branch in tuicr (from its merge-base); w  review uncommitted changes
           exported comments can be sent straight back to the agent
  f        the session's files in yazi: what it changed, at their paths, and what it read
           or ran on under _read/ (links into the worktree, so edits are real)
  y yazi   e nvim   o zed, all in the session's directory
  +/-      preview size (dashboard)   r refresh   q quit

  ● working ○ idle ◌ live in Paseo ◇ parked · ended × gone   ! needs you ⊘ blocked ✓ done`;
