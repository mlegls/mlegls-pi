// optmem: the session as UniiChat's one chat that never ends (VictorTaelin, gist 91837951). A
// memory system owning compaction and context (../mechanism.ts): /memory optmem swaps it in.
//
// The log is the session transcript (./log.ts); a background compactor builds a tree of one-line
// summaries over it (./build.ts); each request is [the view][this run's messages], the view being
// the tree's kept cut (./tree.ts), saved as a cursor so it follows the branch and is never rebuilt.
// A run is everything since the last assistant message that ended one (the user's message, and
// the agent's work on it). Its first request waits (up to waitSeconds) for every message before it
// to be summarized; the view stays fixed for the run, so the run's requests share one cached prefix.
//
// Long runs, which UniiChat's short turns never have: once the run's raw messages pass tailBytes,
// its boundary moves up to the newest message summarized so far (never between a tool call and its
// result), the view advances to it, and the user's message stays whole after the view.
//
// zoom(id, n) and date(id) navigate it; the prompt is ./prompt.md. On Anthropic the view's last
// whole 4-line block carries a cache mark (./cache.ts).
//
// Settings: memory.schemas.optmem { fanout (2), view { high 128000, low 64000 }, compactorView
// { high 32000, low 16000 }, concurrency (8), retries (5), waitSeconds (30), tailBytes (128000),
// model { provider, id, thinking } (default OM's), systemPrompt ("auto" | "turn" | "own"),
// cut ("due" | "scored", ./tree.ts), scorer { provider, id } (default Jev) }.
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { sessionEntryToContextMessages, type ExtensionAPI, type ExtensionContext, type SessionEntry } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { BranchSession } from "../../../lib/records/branch.ts";
import { readCursor, writeCursor } from "../../../lib/records/cursor.ts";
import type { Renderer } from "../../../lib/records/render.ts";
import { activeTools } from "../journal.ts";
import { isActive, type CompactionView, type Mechanism } from "../mechanism.ts";
import { chatParts, markView } from "./cache.ts";
import { Chat, settings, type Env, type Settings } from "./build.ts";
import { PROMPT } from "./prompt.ts";
import { advance, children, emptyView, line, lines, nodeAt, PLACEHOLDER, type View } from "./tree.ts";

const NAME = "optmem";
const VIEW_KEY = "optmem.view";

interface Run {
	/** Branch index of the run's first entry, and the id there. */
	start: number;
	startId: string;
	/** Branch index where the raw tail begins, and how many messages the view covers. */
	boundary: number;
	T: number;
	lines: string[];
	view: AgentMessage;
}

/** Branch index after the last assistant message that ended a run. */
export function runStart(branch: readonly SessionEntry[]): number {
	for (let k = branch.length - 1; k >= 0; k--) {
		const e = branch[k]!;
		if (e.type === "message" && e.message.role === "assistant" && (e.message as { stopReason?: string }).stopReason !== "toolUse") return k + 1;
	}
	return 0;
}

const isResult = (e: SessionEntry | undefined) => e?.type === "message" && e.message.role === "toolResult";

export default function optmem(pi: ExtensionAPI): Mechanism {
	let chat: Chat | undefined;
	let run: Run | undefined;
	let stop = new AbortController();
	const sm = (ctx: ExtensionContext) => ctx.sessionManager as unknown as BranchSession;
	const branchOf = (ctx: ExtensionContext) => ctx.sessionManager.getBranch() as SessionEntry[];

	const env = (ctx: ExtensionContext): Env => {
		const notify = ctx.hasUI ? ctx.ui.notify.bind(ctx.ui) : (m: string) => console.error(m); // print mode: stderr
		return {
			session: ctx.sessionManager.getSessionId(), sm: sm(ctx), model: ctx.model, modelRegistry: ctx.modelRegistry, signal: stop.signal,
			turn: () => ({ systemPrompt: ctx.getSystemPrompt(), tools: activeTools(pi) }),
			notify: (m, level) => { try { notify?.(m, level); } catch {} },
		};
	};

	/** The chat, synced to the branch; undefined while optmem is off. */
	const synced = (ctx: ExtensionContext): Chat | undefined => {
		if (!isActive(NAME, ctx)) return undefined;
		const cfg = settings(ctx.cwd);
		if (!chat || chat.b !== cfg.fanout || chat.cfg.cut !== cfg.cut) chat = new Chat(cfg.fanout, cfg);
		chat.sync(branchOf(ctx), env(ctx));
		return chat;
	};

	/** The saved view advanced to T messages (saved again only when a batch merged). */
	const viewAt = (ctx: ExtensionContext, c: Chat, cfg: Settings, T: number): string[] => {
		let v = readCursor<View>(sm(ctx), VIEW_KEY);
		if (!v || v.b !== c.b || v.upTo > T) v = emptyView(c.b);
		const r = advance(v, T, c.texts, cfg.view.high, cfg.view.low, cfg.cut);
		if (r.view !== v) writeCursor(sm(ctx), VIEW_KEY, r.view);
		if (r.merged) c.rebase(r.view, T);
		return lines(r.view, T, c.texts);
	};

	const viewMessage = (ls: string[]): AgentMessage => ({ role: "user", content: chatParts(ls), timestamp: 0 } as AgentMessage);
	/** How many messages come from branch entries before index k. */
	const before = (c: Chat, k: number) => { let lo = 0, hi = c.T; while (lo < hi) { const mid = (lo + hi) >> 1; if (c.msgs[mid]!.at < k) lo = mid + 1; else hi = mid; } return lo; };
	const at = (ctx: ExtensionContext, c: Chat, cfg: Settings, T: number) => { const ls = viewAt(ctx, c, cfg, T); return { T, lines: ls, view: viewMessage(ls) }; };

	pi.on("session_start", (_e, ctx) => {
		if (stop.signal.aborted) stop = new AbortController();
		chat = undefined; run = undefined;
		const c = synced(ctx);
		if (c && c.pending() > 32) ctx.ui.notify("optmem: summarizing " + c.pending() + " messages of history in the background", "info");
	});
	pi.on("session_shutdown", () => { stop.abort(); });
	pi.on("session_tree", (_e, ctx) => { run = undefined; synced(ctx); });
	pi.on("turn_end", (_e, ctx) => { synced(ctx); });
	pi.on("agent_end", (_e, ctx) => { synced(ctx); });

	const renderer: Renderer<CompactionView, string[]> = {
		name: NAME,
		role: "memory",
		query: () => [],
		cut: (ls) => ls.length ? { text: "<chat>\n" + ls.join("\n") + "\n</chat>" } : undefined,
	};

	pi.registerTool({
		name: "zoom",
		label: "zoom",
		description: "Open the line id+n of the view into the lines under it; n = 1 gives message id whole.",
		parameters: Type.Object({ id: Type.Integer({ description: "First message of the line." }), n: Type.Integer({ description: "How many messages it covers." }) }),
		async execute(_id, params, _signal, _onUpdate, ctx) {
			const c = synced(ctx);
			if (!c) throw new Error("optmem is off in this session");
			const p = nodeAt(c.b, params.id, params.n, c.T);
			if (typeof p === "string") throw new Error(p);
			if (p[0] === 0) {
				const m = c.msgs[params.id]!;
				return { content: [{ type: "text", text: params.id + " " + m.kind + " " + m.date + "\n" + m.text }], details: { id: params.id, entry: m.entry } };
			}
			const out = children(c.b, p).map((q) => line(c.b, q, c.resolve(q) ?? PLACEHOLDER)).join("\n");
			return { content: [{ type: "text", text: out }], details: { id: params.id, n: params.n } };
		},
	});
	pi.registerTool({
		name: "date",
		label: "date",
		description: "The date and time of message id.",
		parameters: Type.Object({ id: Type.Integer() }),
		async execute(_id, params, _signal, _onUpdate, ctx) {
			const c = synced(ctx);
			if (!c) throw new Error("optmem is off in this session");
			const m = c.msgs[params.id];
			if (!m) throw new Error("the chat has " + c.T + " messages");
			return { content: [{ type: "text", text: m.date }], details: { id: params.id } };
		},
	});

	return {
		name: NAME,
		owns: ["compaction", "context"],
		renderer: { ...renderer, query: () => run?.lines ?? [] },
		budget: () => Infinity,
		enabled: (ctx) => settings(ctx.cwd).enabled,
		tools: ["zoom", "date"],
		prompt: (_e, ctx) => PROMPT(settings(ctx.cwd).fanout),
		request: (payload) => markView(payload),
		async context(_messages, ctx) {
			const c = synced(ctx);
			if (!c) return undefined;
			const cfg = settings(ctx.cwd);
			const branch = branchOf(ctx);
			const start = runStart(branch);
			if (!run || run.startId !== branch[start]?.id || run.start !== start) {
				const T = before(c, start);
				await c.idle(T, cfg.waitSeconds * 1000);
				run = { start, startId: branch[start]?.id ?? "", boundary: start, ...at(ctx, c, cfg, T) };
			}
			const raw = (from: number) => branch.slice(from).flatMap((e) => sessionEntryToContextMessages(e));
			let tail = raw(run.boundary);
			if (Buffer.byteLength(JSON.stringify(tail)) > cfg.tailBytes) {
				// the newest boundary with every message before it summarized, and no tool result right after it
				const F = c.summarized();
				let k = branch.length - 1;
				for (; k > run.boundary; k--) if (!isResult(branch[k]) && before(c, k) <= F) break;
				if (k > run.boundary && before(c, k) > run.T) {
					run = { ...run, boundary: k, ...at(ctx, c, cfg, before(c, k)) };
					tail = raw(k);
				}
			}
			// the user's message (and whatever arrived with it) stays whole once the boundary has passed it
			const pinned: AgentMessage[] = [];
			if (run.boundary > run.start) for (let k = run.start; k < run.boundary; k++) {
				const e = branch[k]!;
				if (e.type === "message" && e.message.role === "assistant") break;
				pinned.push(...sessionEntryToContextMessages(e));
			}
			return [run.view, ...pinned, ...tail];
		},
	};
}
