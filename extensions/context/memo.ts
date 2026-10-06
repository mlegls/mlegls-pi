// memo: a permanent memory shared by every session on this machine, after VictorTaelin/OptMem.
// The agent notes one line (≤280 bytes) whenever it learns something of lasting effect; notes are
// numbered 0, 1, 2 … across all sessions. Aligned power-of-two blocks of notes ([0,2), [2,4),
// [0,4) …) are compressed into one line each, bottom-up, forming a binary merge tree; leaves up to
// RAW_MAX notes compress from the notes themselves, larger blocks from their two halves. At session
// start the system prompt gets a cover of the whole log in at most wakeLines lines, finest near the
// present: a block is kept whole iff its size is at most alpha times its age, alpha the smallest
// that fits (a tilted time frame). recall's zoom opens a block into its halves.
//
// Differences from OptMem, all because we own the harness: notes and summaries are records of
// schema "memo" in the shared records store (so search/similar/SQL already reach them); naps run in
// the background on a cheap model instead of being asked of the agent; a block whose summary isn't
// written yet renders as its halves instead of blocking wake; the cover is frozen per session so
// the prompt prefix stays cached. Forgetting is a record too: a summary is live unless a later
// "forget" names it or a block inside it.
//
// It can also be the session's compaction mechanism (/memory memo, or memory.default "memo"), the way Victor uses
// OptMem: at compaction the agent is asked (over a replay of its context, as journal's checkpoint does) to memo what
// should outlast the folded history, including where the work stands, and the folded history is replaced by the
// memory rendered fresh. From then on the system prompt carries only the instructions, so the cover isn't twice in
// context.
//
// Workers (PI_BOARD_TOPIC set) neither read nor write it, like OptMem's subagents: they can't judge
// what is already known.
//
// Settings: memory.schemas.memo { enabled (default false), wakeLines (96), model { provider, id, thinking },
// compaction: { afterTokens, ratio (0.5) } (when it's the active mechanism), maxOutputTokens (8000, the checkpoint) }.
import type { Message, ToolCall } from "@earendil-works/pi-ai";
import { convertToLlm, getAgentDir, type ExtensionAPI, type ExtensionContext, type SessionBeforeCompactEvent, type SessionEntry } from "@earendil-works/pi-coding-agent";
import type { Renderer } from "../../lib/records/render.ts";
import { isActive, type CompactionMechanism, type CompactionView } from "./compaction.ts";
import { activeTools, replay } from "./journal.ts";
import { Type } from "typebox";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { db, write } from "../../lib/records/store.ts";
import { DEFAULTS } from "./om/config.ts";
import { Runtime } from "./om/runtime.ts";
import { resolveWorkerStreamSimple } from "./om/agents/worker-stream.ts";

export const SCHEMA = "memo";
export const ENTRY_BYTES = 280;
const RAW_MAX = 16;

interface Settings { enabled: boolean; wakeLines: number; maxOutputTokens: number; model?: { provider: string; id: string; thinking?: string }; compaction: { afterTokens?: number; ratio?: number } }

export function settings(cwd: string): Settings {
	let j: Record<string, any> = {}, om: Record<string, any> = {};
	for (const path of [join(getAgentDir(), "settings.json"), join(cwd, ".pi", "settings.json")]) {
		if (!existsSync(path)) continue;
		try { const s = JSON.parse(readFileSync(path, "utf8")).memory?.schemas; j = { ...j, ...s?.memo }; om = { ...om, ...s?.om }; } catch {}
	}
	return { enabled: false, wakeLines: 96, maxOutputTokens: 8000, model: om.model, ...j, compaction: { ratio: 0.5, ...j.compaction } };
}

// ---------- the tree (pure) ----------

export type Block = [lo: number, hi: number];

function coverAt(T: number, alpha: number): Block[] {
	let root = 1;
	while (root < T) root *= 2;
	const out: Block[] = [], stack: Block[] = [[0, root]];
	while (stack.length) {
		const [lo, hi] = stack.pop()!;
		if (lo >= T) continue;
		const size = hi - lo;
		if (size > 1 && (hi > T || size > alpha * (T - lo))) { const mid = (lo + hi) / 2; stack.push([mid, hi], [lo, mid]); }
		else out.push([lo, hi]);
	}
	return out.sort((a, b) => a[0] - b[0]);
}

/** At most budget blocks tiling [0,T), finest near T; every note verbatim when they all fit. */
export function cover(T: number, budget: number): Block[] {
	if (T <= 0) return [];
	if (T <= budget) return Array.from({ length: T }, (_, i) => [i, i + 1] as Block);
	let lo = 0, hi = 1;
	for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (coverAt(T, mid).length > budget) lo = mid; else hi = mid; }
	const out = coverAt(T, hi);
	// Sizes jump in powers of two, so alpha can undershoot the budget: spend the rest on the present.
	while (out.length < budget) {
		let i = -1;
		for (let k = out.length - 1; k >= 0; k--) if (out[k][1] - out[k][0] > 1) { i = k; break; }
		if (i < 0) break;
		const [a, b] = out[i], mid = (a + b) / 2;
		out.splice(i, 1, [a, mid], [mid, b]);
	}
	return out;
}

/** Blocks complete in [0,T) without a live summary, smallest level first: halves always precede their parent. */
export function pending(T: number, has: (b: Block) => boolean): Block[] {
	const out: Block[] = [];
	for (let size = 2; size <= T; size *= 2) for (let lo = 0; lo + size <= T; lo += size) if (!has([lo, lo + size])) out.push([lo, lo + size]);
	return out;
}

export const blockName = ([lo, hi]: Block) => lo + "-" + (hi - 1);

export function parseBlock(s: string): Block | undefined {
	const m = /^#?(\d+)-(\d+)$/.exec(s.trim());
	if (!m) return;
	const lo = Number(m[1]), hi = Number(m[2]) + 1, n = hi - lo;
	return n >= 2 && (n & (n - 1)) === 0 && lo % n === 0 ? [lo, hi] : undefined;
}

// ---------- the store ----------

export interface Note { i: number; ts: string; text: string }
export interface State { notes: Note[]; summary: (b: Block) => string | undefined }

const num = (v: unknown) => Number(v);

/** Every note and every live summary. Small: notes are ≤280 bytes, summaries fewer than notes. */
export function load(): State {
	const d = db();
	const rows = d.query(
		"SELECT r.seq, r.ts, r.body, k.value AS kind, i.value AS i, lo.value AS lo, hi.value AS hi FROM records r " +
		"JOIN tags k ON k.record = r.seq AND k.key = 'memo.kind' " +
		"LEFT JOIN tags i ON i.record = r.seq AND i.key = 'memo.i' " +
		"LEFT JOIN tags lo ON lo.record = r.seq AND lo.key = 'memo.lo' " +
		"LEFT JOIN tags hi ON hi.record = r.seq AND hi.key = 'memo.hi' " +
		"WHERE r.schema = 'memo' ORDER BY r.seq").all() as any[];
	const notes: Note[] = [], sums = new Map<string, { seq: number; text: string }>(), forgets: { seq: number; lo: number; hi: number }[] = [];
	for (const r of rows) {
		if (r.kind === "note") notes.push({ i: num(r.i), ts: r.ts, text: r.body });
		else if (r.kind === "summary") sums.set(r.lo + "-" + r.hi, { seq: r.seq, text: r.body });
		else if (r.kind === "forget") forgets.push({ seq: r.seq, lo: num(r.lo), hi: num(r.hi) });
	}
	notes.sort((a, b) => a.i - b.i);
	return {
		notes,
		summary: ([lo, hi]) => {
			const s = sums.get(lo + "-" + hi);
			if (!s || forgets.some((f) => f.seq > s.seq && lo <= f.lo && f.hi <= hi)) return;
			return s.text;
		},
	};
}

export function check(text: string): string {
	const t = text.trim();
	if (!t) throw new Error("Empty. A memory is one line of text.");
	if (/[\r\n]/.test(t)) throw new Error("A memory is one line: merge them, or note them separately.");
	const n = Buffer.byteLength(t);
	if (n > ENTRY_BYTES) throw new Error("Too long: " + n + " bytes, limit " + ENTRY_BYTES + ". Compress it further.");
	return t;
}

/** Append a note; its number is assigned inside a write transaction, so parallel sessions never share one. */
export function note(text: string, session: string, cwd: string): number {
	const d = db(), t = check(text);
	let i = 0;
	d.transaction(() => {
		i = (d.query("SELECT count(*) AS n FROM records r JOIN tags k ON k.record = r.seq AND k.key = 'memo.kind' AND k.value = 'note' WHERE r.schema = 'memo'").get() as { n: number }).n;
		write({ schema: SCHEMA, body: t, tags: [{ key: "memo.kind", value: "note" }, { key: "memo.i", value: i }, { key: "session", value: session }, { key: "cwd", value: cwd }] }, d);
	}).immediate();
	return i;
}

export function writeSummary([lo, hi]: Block, text: string, session: string) {
	write({ schema: SCHEMA, body: check(text), tags: [{ key: "memo.kind", value: "summary" }, { key: "memo.lo", value: lo }, { key: "memo.hi", value: hi }, { key: "session", value: session }] });
}

export function forget([lo, hi]: Block, session: string) {
	write({ schema: SCHEMA, body: "", tags: [{ key: "memo.kind", value: "forget" }, { key: "memo.lo", value: lo }, { key: "memo.hi", value: hi }, { key: "session", value: session }] });
}

// ---------- rendering ----------

const noteLine = (n: Note) => "#" + n.i + " " + n.ts.slice(0, 10) + " " + n.text;

/** A block as one line, or as its halves (recursively) while its summary isn't written yet. */
function lines(s: State, b: Block): string[] {
	const [lo, hi] = b;
	if (hi - lo === 1) return [noteLine(s.notes[lo])];
	const t = s.summary(b);
	if (t !== undefined) return ["#" + blockName(b) + " " + t];
	const mid = (lo + hi) / 2;
	return [...lines(s, [lo, mid]), ...lines(s, [mid, hi])];
}

export function wake(s: State, budget: number): string[] {
	return cover(s.notes.length, budget).flatMap((b) => lines(s, b));
}

/** A block opened into its two halves, each a summary or a note. */
export function zoom(s: State, b: Block): string {
	const [lo, hi] = b, T = s.notes.length;
	if (lo >= T) return "#" + blockName(b) + " is beyond the memory: it holds " + T + " notes.";
	const mid = (lo + hi) / 2;
	return ([[lo, mid], [mid, hi]] as Block[]).filter(([a]) => a < T).map(([a, z]) =>
		z - a === 1 ? noteLine(s.notes[a]) : "#" + blockName([a, z]) + " " + (s.summary([a, z]) ?? "(not compressed yet; zoom further)")).join("\n");
}

const PROMPT = (rendered: string[] | undefined, T: number) => [
	"## Memory",
	"",
	"This is your memory: one log shared by every session on this machine, outliving sessions, compaction and model changes. " +
	"Each line is a note (#n date text) or a one-line summary of a block of notes (#lo-hi text); detail decays with age.",
	"",
	"Call memo({note}) whenever you learn something new or something worth keeping happens: a decision, a fact or insight the user teaches you, " +
	"anything you learn about their life or preferences, a task worth real effort and how it went, any event of lasting effect. One line, at most " + ENTRY_BYTES + " bytes, standing alone. " +
	"Don't note what is already below. Compression happens on its own.",
	"",
	"recall searches every note word for word (search with schema \"memo\"); recall q \"zoom\" args [\"lo-hi\"] opens a block into its halves, down to the notes.",
	"",
	rendered === undefined ? "Your memory as of the last compaction is where the earlier context was." : T ? rendered.join("\n") : "(no notes yet)",
].join("\n");

// ---------- as a compaction mechanism ----------

const CHECKPOINT = "Your context is about to be compacted: everything before the recent tail will be dropped, and your memory, rendered fresh, will stand in for it. " +
	"Call memo once for each thing in the context above that should outlast it and isn't in memory yet: decisions and their reasons, what was tried and how it went, " +
	"facts and preferences learned, and where the work in progress stands and what comes next. One line each, at most " + ENTRY_BYTES + " bytes, standing alone " +
	"(name the project and files; a later reader has none of this context). Don't repeat what memory or your earlier memo calls already hold. If nothing is missing, say so.";

/** Whether this branch's latest compaction was memo's: its summary then carries the cover, so the system prompt doesn't. */
const compacted = (branch: SessionEntry[]) => (branch.findLast((e) => e.type === "compaction") as any)?.details?.kind === SCHEMA;

export const memoRenderer: Renderer<CompactionView & { wakeLines?: number }, State> = {
	name: SCHEMA,
	role: "memory",
	query: () => load(),
	cut(s, budget, view) {
		const lines = wake(s, Number.isFinite(budget) ? budget : 96);
		return {
			text: "Earlier context was compacted. What of it lasts is in your memory, as of now (#n date text: a note; #lo-hi text: a summary of notes lo..hi):\n\n" + (lines.join("\n") || "(no notes yet)"),
			details: { kind: SCHEMA, T: s.notes.length, ...(view.prepared as object | undefined) },
		};
	},
};

// ---------- naps ----------

const NAP_SYSTEM = "You compress an agent's memory log. Reply with exactly one line of at most " + ENTRY_BYTES + " bytes and nothing else. " +
	"Keep what has lasting effect (decisions, facts about the user and their projects, lessons, open threads), drop what does not. Invent nothing. Dense, telegraphic, keep proper names.";

function napInput(s: State, b: Block): string {
	const [lo, hi] = b;
	if (hi - lo <= RAW_MAX) return s.notes.slice(lo, hi).map(noteLine).join("\n");
	const mid = (lo + hi) / 2;
	return ([[lo, mid], [mid, hi]] as Block[]).map((h) => "#" + blockName(h) + " " + s.summary(h)).join("\n");
}

const trimBytes = (t: string) => { let s = t.replace(/\s+/g, " ").trim(); while (Buffer.byteLength(s) > ENTRY_BYTES) s = s.slice(0, -1); return s; };

/** What a nap needs from the session, captured while its ctx is live: naps may outlast it. */
export interface NapEnv { model: unknown; modelRegistry: any; signal: AbortSignal }

async function compress(env: NapEnv, cfg: Settings, input: string, block: Block): Promise<string> {
	const rt = new Runtime();
	rt.config = { ...DEFAULTS, model: cfg.model as any };
	rt.configLoaded = true;
	const r = await rt.resolveModel({ model: env.model, modelRegistry: env.modelRegistry, hasUI: false });
	if (!r.ok) throw new Error(r.reason);
	const model = r.model as any;
	const ask = async (extra: string) => {
		const stream = resolveWorkerStreamSimple(model, env.modelRegistry)(model, {
			systemPrompt: NAP_SYSTEM,
			messages: [{ role: "user", content: [{ type: "text", text: "Compress memories #" + blockName(block) + " into one line.\n\n" + input + extra }], timestamp: Date.now() }],
		} as any, { apiKey: r.apiKey, headers: r.headers, signal: env.signal, reasoning: (cfg.model?.thinking ?? "low") as any, maxTokens: 4000 } as any);
		const msg: any = await stream.result();
		if (msg.stopReason === "error") throw new Error(msg.errorMessage ?? "model error");
		return (msg.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join(" ").replace(/\s+/g, " ").trim();
	};
	let out = await ask("");
	if (Buffer.byteLength(out) > ENTRY_BYTES) out = await ask("\n\nYour last answer was " + Buffer.byteLength(out) + " bytes; the limit is " + ENTRY_BYTES + ". Shorter.");
	return trimBytes(out);
}

let napping = false;
/** Write every pending summary, one at a time, re-reading the store before each (another session may have written it). */
export async function nap(env: NapEnv, cfg: Settings, session: string): Promise<number> {
	if (napping) return 0;
	napping = true;
	let done = 0;
	try {
		for (;;) {
			const s = load();
			const next = pending(s.notes.length, (b) => s.summary(b) !== undefined)[0];
			if (!next || env.signal.aborted) return done;
			const line = await compress(env, cfg, napInput(s, next), next);
			if (env.signal.aborted) return done;
			writeSummary(next, line, session);
			done++;
		}
	} finally { napping = false; }
}

// ---------- extension ----------

export default function memo(pi: ExtensionAPI): CompactionMechanism {
	let wakeLines = 96, busy = false, triggering = false;
	const mechanism: CompactionMechanism = {
		renderer: memoRenderer,
		budget: () => wakeLines,
		enabled: (ctx) => !process.env.PI_BOARD_TOPIC && settings(ctx.cwd).enabled,
		prepare: (event, ctx) => checkpoint(event, ctx),
		begin() { if (busy) return false; busy = true; return true; },
		end() { busy = false; },
	};
	if (process.env.PI_BOARD_TOPIC) return mechanism;
	let frozen: string | undefined;
	let stop = new AbortController();
	const session = (ctx: ExtensionContext) => ctx.sessionManager.getSessionId();
	const napLater = (ctx: ExtensionContext, cfg: Settings) => {
		const env: NapEnv = { model: ctx.model, modelRegistry: ctx.modelRegistry, signal: stop.signal };
		const notify = ctx.hasUI ? ctx.ui.notify.bind(ctx.ui) : undefined;
		nap(env, cfg, session(ctx)).catch((e) => {
			if (env.signal.aborted) return; // pending blocks wait for the next session
			try { notify?.("memo: compression failed: " + (e instanceof Error ? e.message : String(e)), "warning"); } catch {}
		});
	};

	pi.on("session_shutdown", () => { stop.abort(); });

	pi.on("session_start", (_e, ctx) => {
		frozen = undefined;
		if (stop.signal.aborted) stop = new AbortController();
		const cfg = settings(ctx.cwd);
		wakeLines = cfg.wakeLines;
		if (cfg.enabled) napLater(ctx, cfg);
		else pi.setActiveTools(pi.getActiveTools().filter((n) => n !== "memo"));
	});

	pi.on("before_agent_start", (event, ctx) => {
		const cfg = settings(ctx.cwd);
		if (!cfg.enabled) return;
		// Rendered once per session, so the prompt prefix stays cached; this session's own notes are in its context already.
		if (compacted(ctx.sessionManager.getBranch() as SessionEntry[])) return { systemPrompt: event.systemPrompt + "\n\n" + PROMPT(undefined, 0) };
		if (frozen === undefined) { const s = load(); frozen = PROMPT(wake(s, cfg.wakeLines), s.notes.length); }
		return { systemPrompt: event.systemPrompt + "\n\n" + frozen };
	});

	pi.on("agent_settled", (_event, ctx) => {
		const cfg = settings(ctx.cwd);
		if (!cfg.enabled || triggering || busy || !isActive(SCHEMA, ctx)) return;
		const u = ctx.getContextUsage();
		if (!u?.tokens) return;
		if (u.tokens < (cfg.compaction.afterTokens ?? Math.floor(u.contextWindow * (cfg.compaction.ratio ?? 0.5)))) return;
		triggering = true;
		ctx.compact({ onComplete: () => { triggering = false; }, onError: () => { triggering = false; } });
	});

	/** One turn over the replayed context asking for memo calls; the notes are written before the history is dropped. */
	async function checkpoint(event: SessionBeforeCompactEvent, ctx: ExtensionContext) {
		const cfg = settings(ctx.cwd);
		if (!ctx.model) throw new Error("no active model");
		const started = Date.now(), sm = ctx.sessionManager, leaf = sm.getLeafId();
		const { messages, prefixMode } = replay(event, ctx, () => activeTools(pi));
		messages.push({ role: "user", content: [{ type: "text", text: CHECKPOINT + (event.customInstructions ? "\n\nFocus: " + event.customInstructions : "") }], timestamp: Date.now() });
		const thinking = pi.getThinkingLevel();
		const response = await ctx.modelRegistry.streamSimple(ctx.model, { messages: convertToLlm(messages) as Message[] }, {
			sessionId: session(ctx), reasoning: thinking === "off" ? undefined : thinking, maxTokens: Math.min(cfg.maxOutputTokens, ctx.model.maxTokens || cfg.maxOutputTokens), signal: event.signal,
		} as any).result();
		if (response.stopReason === "error" || response.stopReason === "aborted") throw new Error("checkpoint failed: " + (response.errorMessage ?? response.stopReason));
		const current = sm.getBranch() as SessionEntry[], was = current.findIndex((e) => e.id === leaf);
		if (was < 0 || current.slice(was + 1).some((e) => e.type !== "custom")) throw new Error("session changed during the checkpoint");
		const notes: number[] = [], rejected: string[] = [];
		for (const c of response.content.filter((b): b is ToolCall => b.type === "toolCall" && b.name === "memo")) {
			try { notes.push(note(String((c.arguments as any).note ?? ""), session(ctx), ctx.cwd)); } catch (e) { rejected.push(e instanceof Error ? e.message : String(e)); }
		}
		if (notes.length) napLater(ctx, cfg);
		return { notes, rejected, prefixMode, ms: Date.now() - started, usage: response.usage };
	}

	pi.registerTool({
		name: "memo",
		label: "memo",
		description: "Record one memory in the permanent memory every session on this machine shares: one line, at most " + ENTRY_BYTES + " bytes, standing alone. " +
			"For anything learned or decided of lasting effect. Don't repeat what memory already holds.",
		parameters: Type.Object({ note: Type.String({ description: "One line, at most " + ENTRY_BYTES + " bytes." }) }),
		async execute(_id, params, _signal, _onUpdate, ctx) {
			const cfg = settings(ctx.cwd);
			const i = note(params.note, session(ctx), ctx.cwd);
			if (cfg.enabled) napLater(ctx, cfg);
			return { content: [{ type: "text", text: "Saved as #" + i + "." }], details: { i } };
		},
	});
	return mechanism;
}
