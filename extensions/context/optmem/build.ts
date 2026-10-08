// optmem's compactor (gist §4): builds each tree node once, in the background, on a cheap model,
// and records it. A node is a record of schema "optmem" (body: its line), tagged with its key and
// anchored (`at`) to its last message's entry, so it is visible exactly on branches holding
// that message; `summarizes` edges name what it was made from. Its key is that entry, the
// message's place in it, the level and (for merges) the fanout: on a tree path an entry's
// ancestors never change, so the key fixes the content, and forks share nodes.
//
// A source that fits in NODE_BYTES is its own node with no call and no record (a short message
// word for word, or short lines joined by newlines). Otherwise a call compresses one message, or
// merges b adjacent lines, given a ruler of NODE_BYTES dashes (models can't count bytes); a reply
// over it is sent back ("Too long") up to RETRIES times and the shortest kept. Each call sees
// the compaction view, the chat's view merged further (16–32 KB, same sawtooth), up to the node,
// stopping at the first unbuilt line. Up to `concurrency` calls run at once; nodes ready to
// build wait in a queue (leaves as messages arrive, a merge once its children are built), never
// found by scanning the tree. A failed call is tried again at the next sync.
//
// A compaction uses the turns' system prompt and tools (never called) when it runs on the turn
// model, so both read one cache entry; on another model nothing is shared, so it gets its own
// short prompt (./prompt.ts).
//
// cut "scored" (./tree.ts) adds two kinds of record: each merge's loss, judged by Jev once
// (./score.ts; a loss record "scores" the merge), and overlays: a call may name earlier lines its
// input obsoletes or repeats, recorded as obsoletes/duplicates edges from the node to them. A short
// message needs no call of its own, so its overlays wait for the first merge over it that does.
import { getAgentDir, type SessionEntry } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chainRecords, entryRef, visible, type BranchSession } from "../../../lib/records/branch.ts";
import { write } from "../../../lib/records/store.ts";
import { DEFAULTS } from "../om/config.ts";
import { Runtime } from "../om/runtime.ts";
import { resolveWorkerStreamSimple } from "../om/agents/worker-stream.ts";
import { chatParts, markView } from "./cache.ts";
import { messagesOf, msgKey, source, type Msg } from "./log.ts";
import { COMPACTOR_PROMPT } from "./prompt.ts";
import { lossOf } from "./score.ts";
import { advance, bytes, children, emptyView, line, NODE_BYTES, nodeAt, nodesAt, parent, PLACEHOLDER, span, type Cut, type Pair, type Texts, type View } from "./tree.ts";

export const SCHEMA = "optmem";
const VERSION = "v1";

export interface Settings {
	enabled: boolean;
	fanout: number;
	view: { high: number; low: number };
	compactorView: { high: number; low: number };
	concurrency: number;
	retries: number;
	/** How long a turn waits for the messages before it to be summarized. */
	waitSeconds: number;
	/** A run's raw tail past this many bytes moves its boundary up to the newest summarized message. */
	tailBytes: number;
	model?: { provider: string; id: string; thinking?: string };
	/** "auto": the turns' when the compactor runs on the turn model, else its own. */
	systemPrompt: "auto" | "turn" | "own";
	/** "due": UniiChat's, by age alone; "scored": by age over each merge's Jev-judged loss, with overlays. */
	cut: Cut;
	/** The classifier for cut "scored" (default: Jev, wherever there are credentials). */
	scorer?: { provider: string; id: string };
}

export function settings(cwd: string): Settings {
	let j: Record<string, any> = {}, om: Record<string, any> = {};
	for (const path of [join(getAgentDir(), "settings.json"), join(cwd, ".pi", "settings.json")]) {
		if (!existsSync(path)) continue;
		try { const s = JSON.parse(readFileSync(path, "utf8")).memory?.schemas; j = { ...j, ...s?.optmem }; om = { ...om, ...s?.om }; } catch {}
	}
	return {
		enabled: true, fanout: 2, cut: "due", concurrency: 8, retries: 5, waitSeconds: 30, tailBytes: 128_000, systemPrompt: "auto", model: om.model, ...j,
		view: { high: 128_000, low: 64_000, ...j.view }, compactorView: { high: 32_000, low: 16_000, ...j.compactorView },
	};
}

/** What background calls need from the session, captured while its ctx is live. */
export interface Env {
	session: string;
	sm: BranchSession;
	model: unknown;
	modelRegistry: any;
	signal: AbortSignal;
	/** The turns' system prompt and declared tools, for a compactor on the turn model. */
	turn(): { systemPrompt: string; tools: unknown[] };
	notify?(message: string, level: "info" | "warning"): void;
}

const RULER = "-".repeat(NODE_BYTES);
const RETRIES_NOTE = (n: number, cut: string) => "Too long: your line is " + n + " bytes, over the " + NODE_BYTES + "-byte limit. Write\nthe whole line again for the same <input>, cutting just enough of the\nleast valuable items to fit before this cut:\n" + cut + "| ← LIMIT";

/** The first max bytes of s, never splitting a character. */
function headBytes(s: string, max: number): string {
	const buf = Buffer.from(s);
	if (buf.length <= max) return s;
	return buf.subarray(0, max).toString("utf8").replace(/\uFFFD$/, "");
}

const OVERLAY_NOTE = (what: string) => "\nThen, only if " + what + " makes earlier lines of <chat> wholly obsolete (a newer\nversion of the same file or plan, a reversed decision, an error now fixed) or\nrepeats them, add a line for each kind, naming those lines exactly as <chat> does:\nobsoletes: 12+1 40+2\nduplicates: 7+1\nMost messages make nothing obsolete; then add nothing.";
/** Models put it on its own line or at the end of theirs. */
const OVERLAY = /\b(obsoletes|duplicates):\s*((?:\d+\+\d+[\s,;]*)+)/gi;
type Rel = "obsoletes" | "duplicates";
const STUB: Record<Rel, (by: string) => string> = { obsoletes: (by) => "(obsolete: superseded in " + by + ")", duplicates: (by) => "(repeated in " + by + ")" };

const oxford = (xs: string[]) => xs.length <= 2 ? xs.join(" and ") : xs.slice(0, -1).join(", ") + " and " + xs.at(-1);

export class Chat {
	msgs: (Msg & { at: number })[] = [];
	private stored = new Map<string, string>();
	private resolved = new Map<string, string>();
	private queue: Pair[] = [];
	private queued = new Set<string>();
	private failed = new Set<string>();
	private running = 0;
	private waiters: { upTo: number; done: () => void }[] = [];
	private cview: View;
	private frontier = 0;
	/** Scored cut: each merge's loss, and each overlaid node's overlay, by node key. */
	private losses = new Map<string, number>();
	private overlays = new Map<string, { rel: Rel; by: Pair }>();
	private scoreQueue: Pair[] = [];
	private scoreQueued = new Set<string>();
	private scoring = 0;
	env?: Env;

	constructor(readonly b: number, readonly cfg: Settings) {
		this.cview = emptyView(b);
		this.texts = {
			text: (p) => this.resolve(p) ?? PLACEHOLDER, built: (p) => this.resolve(p) !== undefined,
			...(cfg.cut === "scored" ? { loss: (p: Pair) => this.loss(p), stub: (p: Pair, T: number) => this.stub(p, T) } : {}),
		};
	}

	get T() { return this.msgs.length; }

	key(p: Pair): string {
		const [s, n] = span(this.b, p);
		const last = this.msgs[s + n - 1]!;
		return VERSION + ":" + msgKey(last) + ":" + p[0] + (p[0] ? ":" + this.b : "");
	}

	/** A node's text if built (or needing no call), else undefined. */
	resolve(p: Pair): string | undefined {
		const [s, n] = span(this.b, p);
		if (s + n > this.T) return undefined;
		const k = this.key(p);
		const hit = this.resolved.get(k);
		if (hit !== undefined) return hit;
		let out: string | undefined;
		if (p[0] === 0) {
			const src = source(this.msgs[s]!);
			out = bytes(src) <= NODE_BYTES ? src : this.stored.get(k);
		} else {
			const kids = children(this.b, p).map((c) => this.resolve(c));
			if (kids.every((t) => t !== undefined)) {
				const joined = kids.join("\n");
				out = bytes(joined) <= NODE_BYTES ? joined : this.stored.get(k);
			}
		}
		if (out !== undefined) this.resolved.set(k, out);
		return out;
	}

	/** A merge's loss: recorded, or 0 when it is its children word for word. */
	loss(p: Pair): number | undefined {
		const k = this.key(p);
		return this.losses.get(k) ?? (this.stored.has(k) || this.resolve(p) === undefined ? undefined : 0);
	}

	stub(p: Pair, T: number): string | undefined {
		const o = this.overlays.get(this.key(p));
		if (!o) return undefined;
		const [s, n] = span(this.b, o.by);
		return s + n <= T ? STUB[o.rel](s + "+" + n) : undefined;
	}

	readonly texts: Texts;

	/** Read the branch: load its recorded nodes when the path changed, then queue what its new messages need. */
	sync(branch: readonly SessionEntry[], env: Env) {
		this.env = env;
		const old = this.msgs;
		const next = messagesOf(branch);
		const same = old.length <= next.length && old.every((m, k) => msgKey(m) === msgKey(next[k]!));
		this.msgs = next;
		const retry = this.failedRetry;
		this.failed.clear(); this.failedRetry = [];
		if (!same || !old.length) {
			this.gen++;
			this.stored.clear(); this.resolved.clear(); this.queue = []; this.queued.clear(); this.frontier = 0; this.cview = emptyView(this.b);
			this.losses.clear(); this.overlays.clear(); this.scoreQueue = []; this.scoreQueued.clear();
			for (const r of visible(env.sm, chainRecords(env.sm, SCHEMA), branch as unknown as { id: string }[])) {
				const tag = (key: string) => r.record.tags.find((t) => t.key === key)?.value;
				const k = tag("optmem.key"), scores = tag("optmem.scores"), l = tag("optmem.l"), i = tag("optmem.i");
				if (typeof scores === "string") { this.losses.set(scores, Number(tag("optmem.loss"))); continue; }
				if (typeof k === "string") this.stored.set(k, r.record.body);
				for (const e of r.edges) if ((e.rel === "obsoletes" || e.rel === "duplicates") && typeof l === "number" && typeof i === "number")
					this.overlays.set(e.dst.slice(SCHEMA.length + 1), { rel: e.rel, by: [l, i] });
			}
		}
		else for (const p of retry) this.settle(p);
		for (let j = same && old.length ? old.length : 0; j < this.T; j++) this.settle([0, j]);
		this.pump();
	}
	private failedRetry: Pair[] = [];
	/** Bumped when the path changes: builds started before land nowhere. */
	private gen = 0;

	/** A node became available (or arrived): queue it if unbuilt, else see whether its parent is ready. */
	private settle(p: Pair) {
		if (this.resolve(p) === undefined) { if (p[0] === 0) this.enqueue(p); return; }
		if (this.cfg.cut === "scored" && p[0] && this.loss(p) === undefined) this.enqueueScore(p);
		const q = parent(this.b, p);
		const [s, n] = span(this.b, q);
		if (s + n > this.T) return;
		if (!children(this.b, q).every((c) => this.resolve(c) !== undefined)) return;
		if (this.resolve(q) !== undefined) this.settle(q);
		else this.enqueue(q);
	}

	private enqueue(p: Pair) {
		const k = this.key(p);
		if (this.queued.has(k) || this.failed.has(k)) return;
		this.queued.add(k);
		this.queue.push(p);
	}

	private enqueueScore(p: Pair) {
		const k = this.key(p);
		if (this.scoreQueued.has(k)) return;
		this.scoreQueued.add(k);
		this.scoreQueue.push(p);
	}

	/** Scores run beside builds, as many at once; one that fails is tried again on the next path change. */
	private pumpScores() {
		while (this.scoring < this.cfg.concurrency && this.scoreQueue.length && this.env && !this.env.signal.aborted) {
			const p = this.scoreQueue.shift()!;
			const env = this.env, gen = this.gen, k = this.key(p);
			const parts = children(this.b, p).map((c) => line(this.b, c, this.resolve(c)!)), merged = line(this.b, p, this.resolve(p)!);
			this.scoring++;
			lossOf(env.modelRegistry, parts, merged, env.signal, this.cfg.scorer).then((loss) => {
				const last = this.msgs[span(this.b, p).reduce((a, x) => a + x) - 1]!;
				write({
					schema: SCHEMA, body: "loss " + loss.toFixed(3),
					tags: [{ key: "session", value: env.session }, { key: "optmem.scores", value: k }, { key: "optmem.loss", value: loss }],
					edges: [{ rel: "at", dst: entryRef(env.session, last.entry) }, { rel: "scores", dst: SCHEMA + ":" + k }],
				});
				if (gen === this.gen) this.losses.set(k, loss);
			}).catch((e) => {
				if (!env.signal.aborted) env.notify?.("optmem: scoring failed: " + (e instanceof Error ? e.message : String(e)), "warning");
			}).finally(() => { this.scoring--; this.pumpScores(); });
		}
	}

	/** How many messages from the start are summarized. */
	summarized(): number { this.ready(0); return this.frontier; }

	/** Whether every message before upTo is summarized. */
	private ready(upTo: number) {
		while (this.frontier < this.T && this.resolve([0, this.frontier]) !== undefined) this.frontier++;
		return this.frontier >= upTo;
	}

	/** Resolves once every message before upTo is summarized, or after ms. */
	idle(upTo: number, ms: number): Promise<void> {
		if (this.ready(upTo)) return Promise.resolve();
		return new Promise((done) => {
			const w = { upTo, done };
			this.waiters.push(w);
			setTimeout(() => { this.waiters = this.waiters.filter((x) => x !== w); done(); }, ms);
		});
	}

	pending() { return this.queue.length + this.running; }

	private pump() {
		while (this.running < this.cfg.concurrency && this.queue.length && this.env && !this.env.signal.aborted) {
			const p = this.queue.shift()!;
			const env = this.env, gen = this.gen, k = this.key(p);
			this.running++;
			this.build(p, env).then(({ text, overlays }) => {
				if (gen !== this.gen) return; // the path changed; the record is there for whoever returns
				this.stored.set(k, text);
				for (const [target, rel] of overlays) this.overlays.set(target, { rel, by: p });
				this.settle(p);
				this.waiters = this.waiters.filter((w) => { if (this.ready(w.upTo)) { w.done(); return false; } return true; });
			}).catch((e) => {
				if (env.signal.aborted) return;
				if (gen !== this.gen) return;
				this.failed.add(k);
				this.failedRetry.push(p);
				env.notify?.("optmem: compaction failed: " + (e instanceof Error ? e.message : String(e)), "warning");
			}).finally(() => {
				if (gen === this.gen) this.queued.delete(k);
				this.running--;
				this.pump();
			});
		}
		this.pumpScores();
	}

	/** The compaction view's lines up to message limit, stopping at the first unbuilt line. */
	contextLines(limit: number): string[] {
		this.ready(0);
		this.cview = advance(this.cview, this.frontier, this.texts, this.cfg.compactorView.high, this.cfg.compactorView.low, this.cfg.cut).view;
		const out: string[] = [];
		for (const p of nodesAt(this.cview, this.frontier)) {
			const [s, n] = span(this.b, p);
			const t = this.resolve(p);
			if (s + n > limit || t === undefined) break;
			out.push(line(this.b, p, t));
		}
		return out;
	}

	/** The chat's view merged: the compaction view restarts from it, merged further. */
	rebase(view: View, T: number) {
		this.cview = advance({ ...view, shrinking: true }, Math.min(T, this.frontier || T), this.texts, this.cfg.compactorView.high, this.cfg.compactorView.low, this.cfg.cut).view;
	}

	private task(p: Pair): string {
		const [s, n] = span(this.b, p);
		if (p[0] === 0) {
			const m = this.msgs[s]!;
			return "Compaction: compress message " + s + " into one line of at most " + NODE_BYTES + "\nbytes (about 70 words), the length of this ruler:\n" + RULER + "\n<input>\n" + m.kind + ": " + m.text + "\n</input>" + (this.cfg.cut === "scored" ? OVERLAY_NOTE("this message") : "");
		}
		const kids = children(this.b, p);
		const names = kids.map((c) => { const [cs, cn] = span(this.b, c); return cs + "+" + cn; });
		return "Compaction: merge lines " + oxford(names) + ", adjacent, into one line of at most\n" + NODE_BYTES + " bytes (about 70 words), the length of this ruler:\n" + RULER +
			"\n<chat> may hold their messages, " + s + " to " + (s + n - 1) + ", in more detail: take details\nof them from there too.\n<input>\n" +
			kids.map((c) => line(this.b, c, this.resolve(c)!)).join("\n") + "\n</input>" + (this.cfg.cut === "scored" ? OVERLAY_NOTE("what these lines say") : "");
	}

	/** A reply's line, and the overlays it names (scored cut): lines before message s, by node key. */
	private parse(reply: string, s: number): { text: string; overlays: [string, Rel][] } {
		const overlays: [string, Rel][] = [];
		if (this.cfg.cut !== "scored") return { text: reply, overlays };
		const text = reply.replace(OVERLAY, (_all, rel: string, names: string) => {
			for (const nm of names.match(/\d+\+\d+/g) ?? []) {
				const [id, n] = nm.split("+").map(Number);
				const q = nodeAt(this.b, id!, n!, s);
				if (typeof q !== "string") overlays.push([this.key(q), rel.toLowerCase() as Rel]);
			}
			return "";
		});
		return { text: text.trim(), overlays };
	}

	private async build(p: Pair, env: Env): Promise<{ text: string; overlays: [string, Rel][] }> {
		const [s, n] = span(this.b, p);
		const rt = new Runtime();
		rt.config = { ...DEFAULTS, model: this.cfg.model as any };
		rt.configLoaded = true;
		const r = await rt.resolveModel({ model: env.model, modelRegistry: env.modelRegistry, hasUI: false });
		if (!r.ok) throw new Error(r.reason);
		const model = r.model as any, turnModel = env.model as any;
		const same = model?.provider === turnModel?.provider && model?.id === turnModel?.id;
		const useTurn = this.cfg.systemPrompt === "turn" || (this.cfg.systemPrompt === "auto" && same);
		const sys = useTurn ? env.turn() : { systemPrompt: COMPACTOR_PROMPT(this.b), tools: [] };
		const messages: any[] = [{ role: "user", content: [...chatParts(this.contextLines(p[0] ? s + n : s)), { type: "text", text: this.task(p) }], timestamp: Date.now() }];
		const stream = resolveWorkerStreamSimple(model, env.modelRegistry);
		let best: { text: string; overlays: [string, Rel][] } | undefined;
		for (let attempt = 0; attempt < this.cfg.retries; attempt++) {
			const msg: any = await stream(model, { systemPrompt: sys.systemPrompt, messages, tools: sys.tools as any }, {
				// sse: a cached websocket per sessionId would outlive the session (and keep pi -p from exiting)
				apiKey: r.apiKey, headers: r.headers, signal: env.signal, sessionId: "optmem-" + env.session, transport: "sse",
				reasoning: (this.cfg.model?.thinking ?? "medium") as any, maxTokens: 4000, onPayload: (payload: unknown) => markView(payload),
			} as any).result();
			if (msg.stopReason === "error" || msg.stopReason === "aborted") throw new Error(msg.errorMessage ?? msg.stopReason);
			const reply = (msg.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n").trim().replace(/^\d+\+\d+\|/, "");
			const got = this.parse(reply, s);
			const text = got.text;
			if (!text) throw new Error("empty reply");
			if (best === undefined || bytes(text) < bytes(best.text)) best = got;
			if (bytes(text) <= NODE_BYTES) break;
			messages.push(msg, { role: "user", content: [{ type: "text", text: RETRIES_NOTE(bytes(text), headBytes(text, NODE_BYTES)) }], timestamp: Date.now() });
		}
		const last = this.msgs[s + n - 1]!;
		const summarizes = p[0] === 0 ? [entryRef(env.session, last.entry)] : children(this.b, p).map((c) => SCHEMA + ":" + this.key(c));
		write({
			schema: SCHEMA, body: best!.text,
			tags: [{ key: "session", value: env.session }, { key: "optmem.key", value: this.key(p) }, { key: "optmem.l", value: p[0] }, { key: "optmem.i", value: p[1] },
				{ key: "optmem.b", value: this.b }, { key: "optmem.model", value: model.provider + "/" + model.id }],
			edges: [{ rel: "at", dst: entryRef(env.session, last.entry) }, ...summarizes.map((dst) => ({ rel: "summarizes", dst })),
				...best!.overlays.map(([target, rel]) => ({ rel, dst: SCHEMA + ":" + target }))],
		});
		return best!;
	}
}
