// notes: memory that outlives sessions, as OptMem's log and merge tree (VictorTaelin/OptMem). A
// memory system owning nothing (./mechanism.ts), so it composes with whatever owns compaction and
// context; on when listed in memory.systems, or by default when enabled in its settings.
//
// There are two logs. global is shared by every session on this machine; project by every session
// in one git repository (keyed by its common dir, so worktrees share it). The agent notes one line
// (≤280 bytes) at a time, to project unless it names global; a worker can't write global. Each log
// numbers its notes 0, 1, 2 …; aligned power-of-two blocks of notes ([0,2), [2,4), [0,4) …) are
// compressed into one line each, bottom-up, forming a binary merge tree: leaves up to RAW_MAX notes
// compress from the notes themselves, larger blocks from their two halves. A log renders as a
// cover in at most its wakeLines lines, finest near the present: a block is kept whole iff its size
// is at most alpha times its age, alpha the smallest that fits (a tilted time frame). recall's zoom
// opens a block into its halves.
//
// Both render into the system prompt once per session and again after each compaction, so the
// prefix stays cached in between. (Session-local memory belongs to whichever system owns
// compaction; optmem is OptMem's own successor for it.)
//
// Differences from OptMem, because we own the harness: notes and summaries are records of schema
// "memo" in the shared records store (so search/similar/SQL already reach them); naps run in the
// background on a cheap model instead of being asked of the agent; a block whose summary isn't
// written yet renders as its halves instead of blocking wake. Forgetting is a record too: a summary
// is live unless a later "forget" names it or a block inside it.
//
// Settings: memory.schemas.notes (memory.schemas.memo before it) { enabled (default false),
// wakeLines { global 24, project 48 }, model { provider, id, thinking } (naps; default OM's) }.
import { getAgentDir, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { db, write } from "../../lib/records/store.ts";
import { isActive, type Mechanism } from "./mechanism.ts";
import { DEFAULTS } from "./om/config.ts";
import { Runtime } from "./om/runtime.ts";
import { resolveWorkerStreamSimple } from "./om/agents/worker-stream.ts";

export const SCHEMA = "memo";
export const ENTRY_BYTES = 280;
const RAW_MAX = 16;

export type Scope = "global" | "project";
export const SCOPES: Scope[] = ["global", "project"];
const NAME = "notes";

interface Settings { enabled: boolean; wakeLines: Record<Scope, number>; model?: { provider: string; id: string; thinking?: string } }

export function settings(cwd: string): Settings {
	let j: Record<string, any> = {}, om: Record<string, any> = {};
	for (const path of [join(getAgentDir(), "settings.json"), join(cwd, ".pi", "settings.json")]) {
		if (!existsSync(path)) continue;
		try { const s = JSON.parse(readFileSync(path, "utf8")).memory?.schemas; j = { ...j, ...s?.memo, ...s?.notes }; om = { ...om, ...s?.om }; } catch {}
	}
	return { enabled: false, model: om.model, ...j, wakeLines: { global: 24, project: 48, ...j.wakeLines } };
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
const logTags = (log: string, kind: string) => [{ key: "memo.log", value: log }, { key: "memo.kind", value: kind }];

/** One log's notes and live summaries. Small: notes are ≤280 bytes, summaries fewer than notes. */
export function load(log: string): State {
	const rows = db().query(
		"SELECT r.seq, r.ts, r.body, k.value AS kind, i.value AS i, lo.value AS lo, hi.value AS hi FROM records r " +
		"JOIN tags g ON g.record = r.seq AND g.key = 'memo.log' AND g.value = ? " +
		"JOIN tags k ON k.record = r.seq AND k.key = 'memo.kind' " +
		"LEFT JOIN tags i ON i.record = r.seq AND i.key = 'memo.i' " +
		"LEFT JOIN tags lo ON lo.record = r.seq AND lo.key = 'memo.lo' " +
		"LEFT JOIN tags hi ON hi.record = r.seq AND hi.key = 'memo.hi' " +
		"WHERE r.schema = 'memo' ORDER BY r.seq").all(log) as any[];
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

/** Append a note to a log; its number is assigned inside a write transaction, so parallel sessions never share one. */
export function note(log: string, text: string, session: string, cwd: string): number {
	const d = db(), t = check(text);
	let i = 0;
	d.transaction(() => {
		i = (d.query("SELECT count(*) AS n FROM records r JOIN tags g ON g.record = r.seq AND g.key = 'memo.log' AND g.value = ? " +
			"JOIN tags k ON k.record = r.seq AND k.key = 'memo.kind' AND k.value = 'note' WHERE r.schema = 'memo'").get(log) as { n: number }).n;
		write({ schema: SCHEMA, body: t, tags: [...logTags(log, "note"), { key: "memo.i", value: i }, { key: "session", value: session }, { key: "cwd", value: cwd }] }, d);
	}).immediate();
	return i;
}

export function writeSummary(log: string, [lo, hi]: Block, text: string, session: string) {
	write({ schema: SCHEMA, body: check(text), tags: [...logTags(log, "summary"), { key: "memo.lo", value: lo }, { key: "memo.hi", value: hi }, { key: "session", value: session }] });
}

export function forget(log: string, [lo, hi]: Block, session: string) {
	write({ schema: SCHEMA, body: "", tags: [...logTags(log, "forget"), { key: "memo.lo", value: lo }, { key: "memo.hi", value: hi }, { key: "session", value: session }] });
}

// ---------- which logs a session has ----------

const projects = new Map<string, string | undefined>();
/** The git common dir (shared by a repository's worktrees), or none outside a repository. */
export function projectOf(cwd: string): string | undefined {
	if (!projects.has(cwd)) {
		const r = spawnSync("git", ["-C", cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" });
		projects.set(cwd, r.status === 0 ? r.stdout.trim() : undefined);
	}
	return projects.get(cwd);
}

export function logOf(scope: Scope, cwd: string): string | undefined {
	if (scope === "global") return "global";
	const p = projectOf(cwd);
	return p && "project:" + p;
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
	if (lo >= T) return "#" + blockName(b) + " is beyond the log: it holds " + T + " notes.";
	const mid = (lo + hi) / 2;
	return ([[lo, mid], [mid, hi]] as Block[]).filter(([a]) => a < T).map(([a, z]) =>
		z - a === 1 ? noteLine(s.notes[a]) : "#" + blockName([a, z]) + " " + (s.summary([a, z]) ?? "(not compressed yet; zoom further)")).join("\n");
}

/** recall's zoom, for the calling session: args [scope, "lo-hi"]. */
export function zoomFor(ctx: ExtensionContext, scope: string, block: string): string {
	const b = parseBlock(block);
	if (!SCOPES.includes(scope as Scope) || !b) return "zoom needs args: [global | project, \"lo-hi\"], a block as the memory prints it, like [\"project\", \"16-31\"]";
	const log = logOf(scope as Scope, ctx.cwd);
	return log ? zoom(load(log), b) : "This session has no " + scope + " log.";
}

const section = (title: string, rendered: string[]) => "### " + title + "\n" + (rendered.join("\n") || "(no notes yet)");

const PROMPT = (worker: boolean, global: string[], project: string[] | undefined, root: string | undefined) => [
	"## Notes",
	"",
	"Your notes are two logs that outlive sessions, compaction and model changes: global (every session on this machine) and " +
	(root ? "project (every session in " + root + ")" : "project (none here: not in a git repository)") + ". " +
	"Each line is a note (#n date text) or a one-line summary of a block of notes (#lo-hi text); detail decays with age.",
	"",
	"Call note({note, log}) whenever you learn something that holds beyond this session: a decision, a fact or insight the user teaches you, " +
	"anything you learn about their life or preferences, a task worth real effort and how it went, any event of lasting effect. One line, at most " + ENTRY_BYTES + " bytes, standing alone. " +
	"log is project (the default: true of this repository) or global (true of the user or your work in general)" +
	(worker ? "; as a worker you can't write global" : "") + ". Don't note what is already below. Compression happens on its own.",
	"",
	"recall searches every note word for word (search with schema \"memo\"); recall q \"zoom\" args [log, \"lo-hi\"] opens a block into its halves, down to the notes.",
	"",
	section("global", global),
	"",
	project ? section("project", project) : "",
].join("\n").trimEnd();

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
/** Write every pending summary of these logs, one at a time, re-reading the store before each (another session may have written it). */
export async function nap(env: NapEnv, cfg: Settings, logs: string[], session: string): Promise<number> {
	if (napping) return 0;
	napping = true;
	let done = 0;
	try {
		for (const log of logs) for (;;) {
			const s = load(log);
			const next = pending(s.notes.length, (b) => s.summary(b) !== undefined)[0];
			if (env.signal.aborted) return done;
			if (!next) break;
			const line = await compress(env, cfg, napInput(s, next), next);
			if (env.signal.aborted) return done;
			writeSummary(log, next, line, session);
			done++;
		}
		return done;
	} finally { napping = false; }
}

// ---------- extension ----------

export default function notes(pi: ExtensionAPI): Mechanism {
	const worker = !!process.env.PI_WM_HANDLE;
	let frozen: string | undefined;
	let stop = new AbortController();
	const session = (ctx: ExtensionContext) => ctx.sessionManager.getSessionId();
	const logs = (ctx: ExtensionContext) => SCOPES.flatMap((s) => logOf(s, ctx.cwd) ?? []);
	const napLater = (ctx: ExtensionContext) => {
		const env: NapEnv = { model: ctx.model, modelRegistry: ctx.modelRegistry, signal: stop.signal };
		const notify = ctx.hasUI ? ctx.ui.notify.bind(ctx.ui) : undefined;
		nap(env, settings(ctx.cwd), logs(ctx), session(ctx)).catch((e) => {
			if (env.signal.aborted) return; // pending blocks wait for the next session
			try { notify?.("notes: compression failed: " + (e instanceof Error ? e.message : String(e)), "warning"); } catch {}
		});
	};
	const remember = (ctx: ExtensionContext, text: string, scope: Scope = "project") => {
		if (scope === "global" && worker) throw new Error("A worker can't write the global log: note it in project, or report it.");
		const log = logOf(scope, ctx.cwd);
		if (!log) throw new Error("No " + scope + " log here (not in a git repository).");
		return { scope, i: note(log, text, session(ctx), ctx.cwd) };
	};

	pi.on("session_shutdown", () => { stop.abort(); });
	// The cache breaks at compaction anyway; re-rendering keeps what this session noted, whose tool calls just left context.
	pi.on("session_compact", () => { frozen = undefined; });
	pi.on("session_start", (_e, ctx) => {
		frozen = undefined;
		if (stop.signal.aborted) stop = new AbortController();
		if (isActive(NAME, ctx)) napLater(ctx);
	});

	pi.registerTool({
		name: "note",
		label: "note",
		description: "Record one note that outlives this session: one line, at most " + ENTRY_BYTES + " bytes, standing alone, in the project's log (default) or the global one. " +
			"For anything learned or decided of lasting effect. Don't repeat what your notes already hold.",
		parameters: Type.Object({
			note: Type.String({ description: "One line, at most " + ENTRY_BYTES + " bytes." }),
			log: Type.Optional(Type.Union([Type.Literal("project"), Type.Literal("global")], { description: "project (default): true of this repository; global: the user or your work in general." })),
		}),
		async execute(_id, params, _signal, _onUpdate, ctx) {
			const r = remember(ctx, params.note, params.log);
			napLater(ctx);
			return { content: [{ type: "text", text: "Saved to " + r.scope + " as #" + r.i + "." }], details: r };
		},
	});

	return {
		name: NAME,
		owns: [],
		tools: ["note"],
		prompt(_event, ctx) {
			// Rendered once per session and per compaction, so the prompt prefix stays cached.
			if (frozen === undefined) {
				const w = settings(ctx.cwd).wakeLines, project = logOf("project", ctx.cwd);
				frozen = PROMPT(worker, wake(load("global"), w.global), project ? wake(load(project), w.project) : undefined, projectOf(ctx.cwd)?.replace(/\/\.git$/, ""));
			}
			return frozen;
		},
		enabled: (ctx) => settings(ctx.cwd).enabled,
	};
}
