// A life's shared compactor: permanent positions key nodes by life, fanout, level and index.
// life.node records keep the writing model; the first committed record for a key wins.
// life.lease records elect one builder for ten minutes, and polling picks up sibling builds.
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
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { edgesOf, fieldsOf, fieldTags, immediate, select, version, write } from "../../../lib/records/store.ts";
import type { LifeLog, LifeMessage } from "./contracts.ts";
import { DEFAULTS } from "../om/config.ts";
import { Runtime } from "../om/runtime.ts";
import { resolveWorkerStreamSimple } from "../om/agents/worker-stream.ts";
import { chatParts, markView } from "./cache.ts";
import { source } from "./log.ts";
import { COMPACTOR_PROMPT } from "./prompt.ts";
import { lossOf } from "./score.ts";
import { advance, bytes, children, emptyView, line, NODE_BYTES, nodeAt, nodesAt, parent, PLACEHOLDER, span, type Cut, type Pair, type Texts, type View } from "./tree.ts";

export const SCHEMA = "life.node";
const LEASE = "life.lease";
const LEASE_MS = 10 * 60_000;
const POLL_MS = 250;

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
	let j: Record<string, any> = {};
	for (const path of [join(getAgentDir(), "settings.json"), join(cwd, ".pi", "settings.json")]) {
		if (!existsSync(path)) continue;
		try { const s = JSON.parse(readFileSync(path, "utf8")).memory?.schemas; j = { ...j, ...s?.life }; } catch {}
	}
	return {
		enabled: true, fanout: 2, cut: "due", concurrency: 8, retries: 5, waitSeconds: 30, tailBytes: 128_000, systemPrompt: "auto", ...j,
		view: { high: 128_000, low: 64_000, ...j.view }, compactorView: { high: 32_000, low: 16_000, ...j.compactorView },
	};
}

/** What background calls need from the session, captured while its ctx is live. */
export interface Env {
	session: string;
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
	msgs: LifeMessage[] = [];
	private log?: LifeLog;
	private loaded = 0;
	private revision = "";
	private poll?: ReturnType<typeof setInterval>;
	private unlisten?: () => void;
	private leases = new Map<string, { id: string; ts: string }>();
	private waiting = new Map<string, { p: Pair; until: number }>();
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
		return JSON.stringify([this.log?.id, this.b, ...p]);
	}

	/** A node's text if built (or needing no call), else undefined. */
	resolve(p: Pair): string | undefined {
		const [s, n] = span(this.b, p);
		if (s + n > this.T) return undefined;
		const k = this.key(p);
		const hit = this.resolved.get(k);
		if (hit !== undefined) return hit;
		let out = this.stored.get(k);
		if (out !== undefined) { this.resolved.set(k, out); return out; }
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

	/** Read the permanent log and start watching for other writers, even before idle(). */
	sync(log: LifeLog, env: Env) {
		if (this.log?.id !== log.id) {
			this.stopPolling();
			this.gen++;
			this.msgs = []; this.loaded = 0; this.revision = "";
			this.stored.clear(); this.resolved.clear(); this.queue = []; this.queued.clear(); this.frontier = 0; this.cview = emptyView(this.b);
			this.losses.clear(); this.overlays.clear(); this.scoreQueue = []; this.scoreQueued.clear();
			this.leases.clear(); this.waiting.clear(); this.failedRetry = [];
		}
		if (this.env?.signal !== env.signal || !this.unlisten) {
			this.stopPolling();
			const stop = () => this.stopPolling();
			env.signal.addEventListener("abort", stop, { once: true });
			this.unlisten = () => env.signal.removeEventListener("abort", stop);
		}
		this.log = log;
		this.env = env;
		const retry = this.failedRetry;
		this.failed.clear(); this.failedRetry = [];
		this.refresh(true);
		for (const p of retry) this.settle(p);
		this.pump();
		if (!this.poll && !env.signal.aborted) {
			this.poll = setInterval(() => this.refresh(), POLL_MS);
			this.poll.unref();
		}
	}
	private failedRetry: Pair[] = [];
	/** A different life invalidates local calls, but never the shared records. */
	private gen = 0;

	private stopPolling() {
		clearInterval(this.poll); this.poll = undefined;
		this.unlisten?.(); this.unlisten = undefined;
		for (const w of this.waiters.splice(0)) w.done();
	}

	/** Stop watching a discarded chat. The caller's signal cancels its model requests. */
	dispose() {
		this.gen++; this.stopPolling(); this.env = undefined;
		this.queue = []; this.queued.clear(); this.waiting.clear(); this.scoreQueue = [];
	}

	private records(schema: string, after = 0) {
		return select(schema, { after, where: "r.seq IN (SELECT record FROM tags WHERE key = 'life.id' AND value = ?)", params: [this.log!.id] });
	}

	private recorded(field: "key" | "scores", key: string) {
		return select(SCHEMA, { where: "r.seq IN (SELECT record FROM tags WHERE key = ? AND value = ?)", params: ["life." + field, key] }).length > 0;
	}

	private refresh(force = false) {
		if (!this.log) return;
		const revision = version();
		if (force || revision !== this.revision) {
			this.revision = revision;
			const old = this.T;
			this.msgs = this.log.read();
			const records = this.records(SCHEMA, this.loaded);
			const edges = edgesOf(records.map((r) => r.seq));
			const arrived: Pair[] = [];
			for (const r of records) {
				this.loaded = r.seq;
				const f = fieldsOf("life", r.tags);
				if (typeof f.scores === "string") {
					if (!this.losses.has(f.scores)) this.losses.set(f.scores, Number(f.loss));
					continue;
				}
				if (typeof f.key !== "string" || typeof f.l !== "number" || typeof f.i !== "number" || f.b !== this.b || this.stored.has(f.key)) continue;
				this.stored.set(f.key, r.body);
				this.resolved.delete(f.key);
				this.waiting.delete(f.key);
				const p: Pair = [f.l, f.i];
				for (const e of edges) if (e.record === r.seq && (e.rel === "obsoletes" || e.rel === "duplicates"))
					this.overlays.set(e.dst.slice(SCHEMA.length + 1), { rel: e.rel, by: p });
				arrived.push(p);
			}
			for (let j = old; j < this.T; j++) this.settle([0, j]);
			for (const p of arrived) if (span(this.b, p).reduce((a, n) => a + n) <= this.T) this.settle(p);
		}
		for (const [k, w] of this.waiting) if (Date.now() >= w.until) {
			this.waiting.delete(k);
			this.enqueue(w.p);
		}
		this.waiters = this.waiters.filter((w) => { if (this.ready(w.upTo)) { w.done(); return false; } return true; });
		this.pump();
	}

	private tags(p: Pair) {
		return { id: this.log!.id, key: this.key(p), b: this.b, l: p[0], i: p[1] };
	}

	/** SQLite orders leases. Keep our losing lease so it can succeed when an older one expires. */
	private claim(p: Pair): boolean {
		const k = this.key(p), now = Date.now();
		return immediate(() => {
			let ours = this.leases.get(k);
			if (!ours || Date.parse(ours.ts) + LEASE_MS <= now) {
				ours = write({ schema: LEASE, tags: fieldTags("life", this.tags(p)) });
				this.leases.set(k, ours);
			}
			const first = select(LEASE, {
				where: "r.seq IN (SELECT record FROM tags WHERE key = 'life.key' AND value = ?) AND r.ts > ?",
				params: [k, new Date(now - LEASE_MS).toISOString()],
			})[0]!;
			if (first.id === ours.id) return true;
			this.waiting.set(k, { p, until: Date.parse(first.ts) + LEASE_MS });
			return false;
		});
	}

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
		if (this.queued.has(k) || this.failed.has(k) || this.waiting.has(k)) return;
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
				if (gen !== this.gen || env.signal.aborted) return;
				immediate(() => {
					if (this.recorded("scores", k)) return;
					write({ schema: SCHEMA, body: "loss " + loss.toFixed(3),
						tags: fieldTags("life", { id: this.log!.id, scores: k, loss }),
						edges: [{ rel: "scores", dst: SCHEMA + ":" + k }],
					});
				});
				this.refresh(true);
			}).catch((e) => {
				if (!env.signal.aborted) env.notify?.("life: scoring failed: " + (e instanceof Error ? e.message : String(e)), "warning");
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
		this.refresh();
		if (this.ready(upTo) || this.env?.signal.aborted) return Promise.resolve();
		return new Promise((done) => {
			const w = { upTo, done: () => { clearTimeout(timer); done(); } };
			const timer = setTimeout(() => { this.waiters = this.waiters.filter((x) => x !== w); done(); }, ms);
			this.waiters.push(w);
		});
	}

	pending() { return this.queue.length + this.running + this.waiting.size; }

	private pump() {
		while (this.running < this.cfg.concurrency && this.queue.length && this.env && !this.env.signal.aborted) {
			const p = this.queue.shift()!;
			const env = this.env, gen = this.gen, k = this.key(p);
			if (this.resolve(p) !== undefined) { this.queued.delete(k); this.settle(p); continue; }
			if (!this.claim(p)) { this.queued.delete(k); continue; }
			this.running++;
			this.build(p, env, gen).then((got) => {
				if (gen !== this.gen || env.signal.aborted) return;
				if (got) immediate(() => {
					// A lease can expire during a call. A sibling's committed result always wins.
					if (this.recorded("key", k)) return;
					const [s] = span(this.b, p);
					const summarizes = p[0] === 0 ? [this.msgs[s]!.source] : children(this.b, p).map((c) => SCHEMA + ":" + this.key(c));
					write({ schema: SCHEMA, body: got.text,
						tags: fieldTags("life", { ...this.tags(p), model: got.model }),
						edges: [...summarizes.map((dst) => ({ rel: "summarizes", dst })),
							...got.overlays.map(([target, rel]) => ({ rel, dst: SCHEMA + ":" + target }))],
					});
				});
				this.refresh(true);
			}).catch((e) => {
				if (env.signal.aborted) return;
				if (gen !== this.gen) return;
				this.failed.add(k);
				this.failedRetry.push(p);
				env.notify?.("life: compaction failed: " + (e instanceof Error ? e.message : String(e)), "warning");
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
			return "Compaction: compress message " + s + " into one line of at most " + NODE_BYTES + "\nbytes (about 70 words), the length of this ruler:\n" + RULER + "\nKeep each item's kind@place attribution.\n<input>\n" + source(m) + "\n</input>" + (this.cfg.cut === "scored" ? OVERLAY_NOTE("this message") : "");
		}
		const kids = children(this.b, p);
		const names = kids.map((c) => { const [cs, cn] = span(this.b, c); return cs + "+" + cn; });
		return "Compaction: merge lines " + oxford(names) + ", adjacent, into one line of at most\n" + NODE_BYTES + " bytes (about 70 words), the length of this ruler:\n" + RULER +
			"\n<chat> may hold their messages, " + s + " to " + (s + n - 1) + ", in more detail: take details\nof them from there too.\nKeep each item's kind@place attribution.\n<input>\n" +
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

	private async build(p: Pair, env: Env, gen: number): Promise<{ text: string; overlays: [string, Rel][]; model: string } | undefined> {
		const [s, n] = span(this.b, p);
		const rt = new Runtime();
		rt.config = { ...DEFAULTS, model: this.cfg.model as any };
		rt.configLoaded = true;
		const r = await rt.resolveModel({ model: env.model, modelRegistry: env.modelRegistry, hasUI: false });
		if (!r.ok) throw new Error(r.reason);
		if (gen !== this.gen || env.signal.aborted) return;
		const model = r.model as any, turnModel = env.model as any;
		const same = model?.provider === turnModel?.provider && model?.id === turnModel?.id;
		const useTurn = this.cfg.systemPrompt === "turn" || (this.cfg.systemPrompt === "auto" && same);
		const sys = useTurn ? env.turn() : { systemPrompt: COMPACTOR_PROMPT(this.b), tools: [] };
		const messages: any[] = [{ role: "user", content: [...chatParts(this.contextLines(p[0] ? s + n : s)), { type: "text", text: this.task(p) }], timestamp: Date.now() }];
		const stream = resolveWorkerStreamSimple(model, env.modelRegistry);
		let best: { text: string; overlays: [string, Rel][] } | undefined;
		for (let attempt = 0; attempt < this.cfg.retries; attempt++) {
			env.signal.throwIfAborted();
			if (gen !== this.gen) return;
			this.refresh();
			if (this.stored.has(this.key(p)) || !this.claim(p)) return;
			const msg: any = await stream(model, { systemPrompt: sys.systemPrompt, messages, tools: sys.tools as any }, {
				// sse: a cached websocket per sessionId would outlive the session (and keep pi -p from exiting)
				apiKey: r.apiKey, headers: r.headers, signal: env.signal, sessionId: "life-" + env.session, transport: "sse",
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
		return { ...best!, model: model.provider + "/" + model.id };
	}
}
