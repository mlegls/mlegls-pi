// Context composition of a pi session: what filled its window, cell by cell, and what each cell was
// for. Feeds the bento view in lib/timeline.ts (click a lane label) and the retro profile pass.
//   bun lib/context.ts [SESSION] [--fast] [--no-elide]   purpose totals: in the window at the end, and token × calls held
//
// A cell is one entry as the model sees it: the system prompt (and tool definitions), a user turn, an
// assistant's text or thinking, a tool call with its result, a custom message, a compaction summary.
// Sizes are chars/4, rescaled per model call so the cells new since the previous call add up to the
// reported growth in context (input + cacheRead + cacheWrite). A cell is born at the first call that
// sees it and dies at the compaction that drops it, so tok × (died − born) is what it cost in reads.
//
// Cold-cache elision (extensions/context/elide.ts) is modelled from the branch the same way: a tool output
// of at least minTokens before the last keepTurns user turns shrinks to its recall pointer at the first call
// after a user turn that follows an idle gap longer than the provider's cache lifetime (`elided`).
//
// Purpose comes from the decider (Jev via lib/decide.ts), cached in ~/.cache/profile/purpose.json;
// small cells, user turns, summaries and messages are classed by kind and tool name. --fast skips the decider.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type CellKind = "system" | "user" | "text" | "thinking" | "tool" | "message" | "summary";
export interface Cell {
	k: CellKind; label: string; tok: number;
	/** First and one-past-last model call index (into Context.calls) whose window held it. */
	born: number; died: number;
	/** The call from which only the elision pointer (ELIDED tokens) stayed, if elided. */
	elided?: number;
	purpose: string; p?: number;
	preview: string;
}
export interface Context { calls: number[]; compactions: number[]; cells: Cell[] }

export const PURPOSE = {
	type: "choice" as const,
	instructions: "This is one item in an AI coding agent's context window: its own text, its thinking, or a tool call and result. What was the agent doing with it?",
	criteria: {
		orient: "Reading code, docs or state to understand where things stand: reading files, searching, listing, git log or status.",
		discuss: "Talking with the user: explaining, answering, proposing, reporting results.",
		plan: "Deciding what to do: weighing options, designing, breaking down a task, choosing an approach.",
		edit: "Making a change: writing or editing files, committing.",
		verify: "Checking work that should be right: running tests or type checks, trying the thing, screenshots.",
		debug: "Diagnosing something that went wrong: reading errors, investigating unexpected behavior, retrying a fix.",
		coordinate: "Working with other agents or sessions: board messages, mail, dispatching or integrating workers.",
		noise: "Wasted: a failed or malformed call, a duplicate read, huge irrelevant output.",
	},
};
const JUDGE_MIN = 150; // tokens; smaller cells are classed by kind and name
const CACHE = join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "profile", "purpose.json");

const textOf = (c: unknown): string => typeof c === "string" ? c : Array.isArray(c) ? c.map((x: any) => x?.type === "text" ? x.text : x?.type === "image" ? "[image]" : "").join("\n") : "";
const str = (x: unknown) => typeof x === "string" ? x : JSON.stringify(x ?? "");
const est = (s: string) => Math.ceil(s.length / 4);
const one = (s: string, n: number) => s.replace(/\s+/g, " ").trim().slice(0, n);
const ends = (s: string, a: number, b: number) => s.length <= a + b ? s : s.slice(0, a) + "\n…\n" + s.slice(-b);

const byName = (name: string, error: boolean): string =>
	error ? "noise"
	: /^(read|grep|find|ls|recall)$/.test(name) ? "orient"
	: /^(edit|write)$/.test(name) ? "edit"
	: /^(board_|mail|dispatch|integrate|retire|reconcile|subagent)/.test(name) ? "coordinate"
	: "other";

/** What a tool call did, in a line: the bash command, the path, codemode's inner calls. */
const toolLabel = (name: string, a: any, nested?: any[]) =>
	name === "bash" ? "bash: " + one(str(a?.command), 70)
	: name === "codemode" && nested?.length ? "codemode: " + [...new Set(nested.map(c => c.name === "bash" ? "bash " + one(str(c.arguments?.command ?? safe(c.args)?.command), 30) : c.name))].slice(0, 4).join(", ")
	: a?.path ? name + " " + one(str(a.path), 70)
	: name + " " + one(str(a), 60);
const safe = (s: unknown): any => { try { return typeof s === "string" ? JSON.parse(s) : s; } catch { return {}; } };

type Judged = Cell & { key?: string; judgeText?: string; out?: number; tool?: string };
export const ELIDED = 25;
/** Tokens a cell takes in the window at a call, and tokens × calls over its life. */
export const sizeAt = (c: Cell, call: number) => c.born <= call && call < c.died ? (c.elided !== undefined && call >= c.elided ? ELIDED : c.tok) : 0;
export const heldTok = (c: Cell) => c.elided === undefined ? c.tok * (c.died - c.born) : c.tok * (c.elided - c.born) + ELIDED * (c.died - c.elided);
export interface Elide { idleMs: (provider: string) => number; minTokens: number; keepTurns: number }
/** The elision settings in effect (memory.elide in pi settings), or undefined when it is off. */
export async function elideSettings(cwd = process.cwd()): Promise<Elide | undefined> {
	const s = (await import("../extensions/context/elide")).settings(cwd);
	return s.enabled ? { idleMs: p => (s.idleSeconds[p] ?? s.idleSeconds.default!) * 1000, minTokens: s.minTokens, keepTurns: s.keepTurns } : undefined;
}

export function contextFile(file: string, id: string, elide?: Elide): Context & { cells: Judged[] } {
	const calls: number[] = [], compactions: number[] = [];
	const cells: (Judged & { eid: string })[] = [];
	const tools = new Map<string, Judged & { eid: string }>();
	const order: string[] = [];
	let fresh: Judged[] = [], compacted = false;
	let prevTs = 0, provider: string | undefined;
	const users: number[] = []; // cells index of each user turn
	const push = (eid: string, c: Omit<Judged, "born" | "died">) => { const x = { ...c, eid, born: calls.length, died: -1 }; cells.push(x); fresh.push(x); return x; };
	const system: Judged & { eid: string } = { k: "system", label: "system prompt and tools", tok: 0, born: 0, died: -1, purpose: "system", preview: "", eid: "" };
	cells.push(system);
	for (const line of readFileSync(file, "utf8").split("\n")) {
		if (!line) continue;
		let e: any; try { e = JSON.parse(line); } catch { continue; }
		const eid = String(e.id ?? "");
		if (e.type === "compaction") {
			const at = order.indexOf(e.firstKeptEntryId), keep = new Set(at < 0 ? [] : order.slice(at));
			for (const c of cells) if (c.died < 0 && c.k !== "system" && !keep.has(c.eid)) c.died = calls.length;
			compactions.push(calls.length); compacted = true;
			push(eid, { k: "summary", label: "compaction summary", tok: est(e.summary ?? ""), purpose: "summary", preview: one(e.summary ?? "", 300) });
		}
		if (eid) order.push(eid);
		if (e.type === "branch_summary") push(eid, { k: "summary", label: "branch summary", tok: est(e.summary ?? ""), purpose: "summary", preview: one(e.summary ?? "", 300) });
		if (e.type === "custom_message") { const t = textOf(e.content); push(eid, { k: "message", label: e.customType + ": " + one(t, 60), tok: est(t), purpose: e.customType === "board" ? "coordinate" : "message", preview: one(t, 300) }); }
		if (e.type !== "message") continue;
		const m = e.message;
		const mts = typeof m.timestamp === "number" ? m.timestamp : Date.parse(e.timestamp);
		if (m.role === "user") {
			if (elide && provider !== undefined && users.length >= elide.keepTurns && mts - prevTs >= elide.idleMs(provider)) {
				const cut = elide.keepTurns ? users[users.length - elide.keepTurns]! : cells.length;
				for (const c of cells.slice(0, cut)) if (c.k === "tool" && c.died < 0 && c.elided === undefined && c.tool !== "journal" && (c.out ?? 0) >= elide.minTokens) c.elided = calls.length;
			}
			users.push(cells.length);
			const t = textOf(m.content);
			push(eid, { k: "user", label: "user: " + one(t.replace(/<skill name="([^"]+)"[\s\S]*?<\/skill>/g, "/$1"), 70), tok: est(t), purpose: "user", preview: one(t, 300) });
		} else if (m.role === "assistant") {
			provider = m.provider ?? provider;
			const u = m.usage ?? {}, ctx = (u.input ?? 0) + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0);
			if (ctx > 0) {
				const sum = fresh.reduce((s, c) => s + c.tok, 0);
				if (!calls.length) system.tok = Math.max(0, ctx - sum);
				else if (!compacted && sum > 0 && ctx > calls.at(-1)!) { const f = (ctx - calls.at(-1)!) / sum; for (const c of fresh) c.tok = Math.round(c.tok * f); }
				calls.push(ctx); fresh = []; compacted = false;
			}
			for (const c of Array.isArray(m.content) ? m.content : []) {
				if (c?.type === "thinking" && c.thinking) push(eid, { k: "thinking", label: "thinking: " + one(c.thinking, 70), tok: est(c.thinking), purpose: "plan", preview: one(c.thinking, 300), key: id + "/" + eid + "/th", judgeText: ends(c.thinking, 1200, 300) });
				if (c?.type === "text" && c.text) push(eid, { k: "text", label: "text: " + one(c.text, 70), tok: est(c.text), purpose: "discuss", preview: one(c.text, 300), key: id + "/" + eid + "/tx", judgeText: ends(c.text, 1200, 300) });
				if (c?.type === "toolCall") tools.set(c.id, push(eid, { k: "tool", label: toolLabel(c.name, c.arguments), tok: est(c.name + str(c.arguments)), purpose: byName(c.name, false), preview: "", key: id + "/" + c.id, judgeText: c.name + " " + ends(str(c.arguments), 600, 200) }));
			}
		} else if (m.role === "toolResult") {
			const r = textOf(m.content), nested = m.nestedCalls?.calls ?? m.details?.calls;
			const c = tools.get(m.toolCallId) ?? push(eid, { k: "tool", label: m.toolName ?? "?", tok: 0, purpose: "other", preview: "", key: id + "/" + eid });
			c.tok += est(r); c.out = est(r); c.tool = m.toolName;
			if (Array.isArray(nested)) c.label = toolLabel(m.toolName, {}, nested);
			if (m.isError) c.purpose = "noise";
			c.preview = one(r, 300);
			c.judgeText = (c.judgeText ?? "") + (m.isError ? "\n→ ERROR " : "\n→ ") + ends(r, 900, 300);
		}
		prevTs = mts;
	}
	if (!calls.length) cells.shift();
	for (const c of cells) if (c.died < 0) c.died = calls.length;
	return { calls, compactions, cells: cells.map(({ eid, ...c }) => c) };
}

/** Class the bigger assistant-side cells with the decider; the rest keep their kind/name class. */
export async function judgePurposes(ctxs: Context[]): Promise<void> {
	let cache: Record<string, { choice: string; p: number }> = {};
	try { cache = JSON.parse(readFileSync(CACHE, "utf8")); } catch {}
	const items = ctxs.flatMap(x => x.cells as Judged[]).filter(c => c.key && c.judgeText && c.tok >= JUDGE_MIN && c.purpose !== "noise");
	const todo = items.filter(c => !cache[c.key!]);
	if (todo.length) {
		let decide: typeof import("./decide").decide;
		try { decide = (await import("./decide")).decide; } catch { return; }
		let failed = 0; const queue = [...todo];
		await Promise.all(Array.from({ length: 12 }, async () => {
			for (let c = queue.shift(); c; c = queue.shift()) {
				try { const { purpose } = await decide({ kind: c.k, item: c.judgeText! }, { purpose: PURPOSE }); cache[c.key!] = { choice: purpose.choice, p: purpose.p }; }
				catch { failed++; }
			}
		}));
		if (failed < todo.length) { mkdirSync(dirname(CACHE), { recursive: true }); writeFileSync(CACHE, JSON.stringify(cache)); }
	}
	for (const c of items) { const j = cache[c.key!]; if (j) { c.purpose = j.choice; c.p = j.p; } }
}

/** Drop the decider's inputs before embedding. */
export const strip = (x: Context): Context => ({ ...x, cells: (x.cells as Judged[]).map(({ key, judgeText, out, tool, ...c }) => c) });

if (import.meta.main) {
	const { graph } = await import("./tree/graph");
	const args = process.argv.slice(2);
	const fast = args.includes("--fast"), ref = args.find(a => !a.startsWith("--")) ?? process.env.PI_SESSION_ID ?? "";
	const nodes = await graph({ days: 30 });
	const hits = [...nodes.keys()].filter(k => k === ref || k.endsWith(ref) || k.startsWith(ref));
	if (hits.length !== 1) throw new Error((hits.length ? "ambiguous: " : "no session matches ") + ref);
	const x = contextFile(nodes.get(hits[0]!)!.file, hits[0]!, args.includes("--no-elide") ? undefined : await elideSettings());
	if (!fast) await judgePurposes([x]);
	const last = x.calls.length - 1, now: Record<string, number> = {}, held: Record<string, number> = {};
	for (const c of x.cells) { now[c.purpose] = (now[c.purpose] ?? 0) + sizeAt(c, last); held[c.purpose] = (held[c.purpose] ?? 0) + heldTok(c); }
	const el = x.cells.filter(c => c.elided !== undefined);
	console.log("elided: " + el.length + " outputs, " + (el.reduce((s, c) => s + c.tok, 0) / 1e3).toFixed(0) + "k tok");
	const show = (r: Record<string, number>) => Object.entries(r).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + " " + (v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : (v / 1e3).toFixed(0) + "k")).join(", ");
	console.log(x.calls.length + " calls, " + x.compactions.length + " compactions, " + x.cells.length + " cells; last window " + ((x.calls[last] ?? 0) / 1e3).toFixed(0) + "k");
	console.log("now:  " + show(now));
	console.log("held: " + show(held));
}
