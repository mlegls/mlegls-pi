// A named life's context: [shared view][present][whole current run].
// Completed runs append atomically. Long runs append a complete prefix before moving their
// boundary; their user's message stays whole. Views only advance in the shared store.
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { sessionEntryToContextMessages, type ExtensionAPI, type ExtensionContext, type SessionEntry } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { sessionChain } from "../../../lib/records/branch.ts";
import { fieldTags, immediate, stamp, write } from "../../../lib/records/store.ts";
import type { Renderer } from "../../../lib/records/render.ts";
import { notice, NOTICE } from "../../../lib/notice.ts";
import { activeTools } from "../journal.ts";
import { isActive, type CompactionView, type Mechanism } from "../mechanism.ts";
import { ATTACHMENT, attachment } from "./attachment.ts";
import { chatParts, markView } from "./cache.ts";
import { Chat, settings, type Env, type Settings } from "./build.ts";
import { PROMPT } from "./prompt.ts";
import { lifeId, lifeLog, lifeMessages, ofLife, source } from "./log.ts";
import { present } from "./present.ts";
import type { LifeRun } from "./contracts.ts";
import { advance, children, emptyView, line, lines, nodeAt, nodesAt, PLACEHOLDER, span, type Pair, type View } from "./tree.ts";

export { attachedLife } from "./attachment.ts";

const NAME = "life";
const VIEW = "life.view";

interface Run {
	record: LifeRun;
	/** Branch indices: first entry of this run, and first entry still in the raw tail. */
	start: number;
	boundary: number;
	T: number;
	present: AgentMessage;
	lines?: string[];
	view?: AgentMessage;
}

/** Branch index after the last assistant message that ended a run. */
export function runStart(branch: readonly SessionEntry[]): number {
	for (let k = branch.length - 1; k >= 0; k--) {
		const e = branch[k]!;
		if (e.type === "message" && e.message.role === "assistant" && e.message.stopReason !== "toolUse") return k + 1;
	}
	return 0;
}

const message = (text: string): AgentMessage => ({ role: "user", content: text, timestamp: 0 });
const visible = (branch: readonly SessionEntry[]) => branch.filter((e) => !(e.type === "custom_message" && e.customType === NOTICE));
const raw = (branch: readonly SessionEntry[]) => visible(branch).flatMap((e) => sessionEntryToContextMessages(e));

/** Project a newer saved cut back to a run's captured position, without changing the saved cut. */
function before(view: View, T: number): View {
	if (view.upTo <= T) return view;
	const nodes: Pair[] = [];
	const keep = (p: Pair) => {
		const [s, n] = span(view.b, p);
		if (s >= T) return;
		if (s + n <= T) nodes.push(p);
		else for (const q of children(view.b, p)) keep(q);
	};
	for (const p of view.nodes) keep(p);
	return { ...view, nodes, upTo: T };
}

/** Read/advance under the same lock: an older run can never overwrite a newer saved view. */
function viewAt(id: string, c: Chat, cfg: Settings, T: number): string[] {
	const r = immediate(() => {
		const saved = ofLife(VIEW, id).at(-1);
		const v: View = saved ? JSON.parse(saved.body) : emptyView(c.b);
		const local = v.b === c.b ? before(v, T) : emptyView(c.b);
		const advanced = advance(local, T, c.texts, cfg.view.high, cfg.view.low, cfg.cut);
		if (T > v.upTo) write({
			schema: VIEW, body: JSON.stringify({ ...advanced.view, nodes: nodesAt(advanced.view, T), upTo: T }),
			tags: fieldTags("life", { id, upTo: T }),
		});
		return advanced;
	});
	if (r.merged) c.rebase(r.view, T);
	return lines(r.view, T, c.texts);
}

/** Latest boundary that leaves complete call/result groups on each side, and some work raw. */
function safeBoundary(branch: readonly SessionEntry[], from: number): number {
	const pending = new Set<string>();
	let boundary = from;
	for (let k = from; k < branch.length; k++) {
		const e = branch[k]!;
		if (!pending.size && !(e.type === "message" && e.message.role === "toolResult")) boundary = k;
		if (e.type !== "message") continue;
		if (e.message.role === "assistant") for (const part of e.message.content)
			if (part.type === "toolCall") pending.add(part.id);
		if (e.message.role === "toolResult") pending.delete(e.message.toolCallId);
	}
	return boundary;
}

export default function life(pi: ExtensionAPI): Mechanism {
	let startupName = process.env.PI_LIFE;
	delete process.env.PI_LIFE;
	let chat: Chat | undefined;
	let id: string | undefined;
	let run: Run | undefined;
	let stop = new AbortController();
	const branchOf = (ctx: ExtensionContext) => ctx.sessionManager.getBranch();

	const env = (ctx: ExtensionContext): Env => ({
		session: ctx.sessionManager.getSessionId(), model: ctx.model, modelRegistry: ctx.modelRegistry, signal: stop.signal,
		turn: () => ({ systemPrompt: ctx.getSystemPrompt(), tools: activeTools(pi) }),
		notify: (m, level) => { if (ctx.hasUI) ctx.ui.notify(m, level); else console.error(m); },
	});

	const discard = () => {
		stop.abort(); chat?.dispose(); chat = undefined; run = undefined; id = undefined;
		stop = new AbortController();
	};
	const synced = (ctx: ExtensionContext): Chat | undefined => {
		const attached = attachment(ctx);
		if (!attached) return;
		const cfg = settings(ctx.cwd);
		if (id !== attached.id || chat?.b !== cfg.fanout || chat?.cfg.cut !== cfg.cut) {
			discard(); id = attached.id; chat = new Chat(cfg.fanout, cfg);
		}
		chat!.sync(lifeLog(id!), env(ctx));
		return chat;
	};
	const append = (ctx: ExtensionContext, branch = branchOf(ctx)) => {
		const a = attachment(ctx);
		if (!a) return;
		lifeLog(a.id).append(lifeMessages(visible(branch), {
			session: ctx.sessionManager.getSessionId(), sessions: sessionChain(ctx.sessionManager),
			place: process.env.BB_THREAD_ID ?? ctx.sessionManager.getSessionId(),
			model: ctx.model ? ctx.model.provider + "/" + ctx.model.id : "",
			selfThreads: present(a.id).threads(),
		}));
	};
	const end = () => {
		if (run && id) present(id).end(run.record.id);
		run = undefined;
	};
	const record = (ctx: ExtensionContext): LifeRun => ({
		id: stamp().id, time: new Date().toISOString(), session: ctx.sessionManager.getSessionId(),
		sessionFile: ctx.sessionManager.getSessionFile() ?? "", pid: process.pid,
		...(process.env.BB_THREAD_ID ? { thread: process.env.BB_THREAD_ID } : {}),
	});
	const open = async (ctx: ExtensionContext, start: number) => {
		const c = synced(ctx);
		if (!c) return;
		const T = c.T, p = present(id!), r = record(ctx);
		p.start(r);
		run = { record: r, start, boundary: start, T, present: message("<present>\n" + await p.snapshot() + "\n</present>") };
	};
	const idlePresence = (ctx: ExtensionContext) => {
		const a = attachment(ctx);
		if (a) { const p = present(a.id), r = record(ctx); p.start(r); p.end(r.id); }
	};
	const change = (name: string, ctx: ExtensionContext) => {
		const next = name === "off" ? undefined : lifeId(name, ctx.cwd);
		if (name !== "off" && !next) throw new Error("Use /life <name> inside a git repository, or /life /<name> machine-wide");
		const old = attachment(ctx);
		if (old) { append(ctx); end(); present(old.id).detach(ctx.sessionManager.getSessionId()); }
		pi.appendEntry(ATTACHMENT, next ? { name, id: next } : null);
		discard();
		if (next) { append(ctx); synced(ctx); idlePresence(ctx); }
		pi.events.emit("memory:changed", ctx);
	};
	pi.events.on("life:attach", (data) => {
		const { name, ctx } = data as { name: string; ctx: ExtensionContext };
		// An explicit launcher attachment takes precedence over the startup model.
		if (startupName === undefined && ctx.isIdle()) change(name, ctx);
	});
	pi.registerCommand("life", {
		description: "Attach to a named life: /life [name | /machine-wide-name | off]",
		handler: async (args, ctx) => {
			if (args.trim()) {
				if (!ctx.isIdle()) { notice(pi, ctx, "Change life between runs", "warning"); return; }
				await change(args.trim(), ctx);
			}
			const a = attachment(ctx);
			notice(pi, ctx, a ? "Life: " + a.name + " (" + a.id + ")" : "Life: off", "info");
		},
	});
	pi.on("session_start", async (_e, ctx) => {
		discard();
		const name = startupName; startupName = undefined;
		if (name !== undefined) await change(name.trim(), ctx);
		else { append(ctx); synced(ctx); idlePresence(ctx); }
	});
	pi.on("session_shutdown", () => { end(); discard(); });
	pi.on("session_tree", (_e, ctx) => { end(); discard(); append(ctx); synced(ctx); });
	pi.on("before_agent_start", async (_e, ctx) => {
		if (!isActive(NAME, ctx)) return;
		end();
		await open(ctx, branchOf(ctx).length);
	});
	pi.on("turn_end", (e, ctx) => {
		if (!attachment(ctx) || e.message.role !== "assistant" || e.message.stopReason === "toolUse") return;
		append(ctx); end(); synced(ctx);
	});

	const renderer: Renderer<CompactionView, string[]> = {
		name: NAME, role: "memory", query: () => run?.lines ?? [],
		cut: (ls) => ls.length ? { text: "<chat>\n" + ls.join("\n") + "\n</chat>" } : undefined,
	};
	pi.registerTool({
		name: "hold", label: "hold",
		description: "One line of what you are holding in this thread. Empty text clears it.",
		parameters: Type.Object({ text: Type.String() }),
		async execute(_id, { text }, _signal, _onUpdate, ctx) {
			if (!synced(ctx)) throw new Error("life is off in this session");
			present(id!).hold(ctx.sessionManager.getSessionId(), text);
			return { content: [{ type: "text", text: text.trim() ? "Holding: " + text : "Hold cleared" }], details: {} };
		},
	});
	pi.registerTool({
		name: "catch_up", label: "catch up",
		description: "Leaf lines committed since this run's view, with their places; with thread, your unfinished run there, whole.",
		parameters: Type.Object({ thread: Type.Optional(Type.String()) }),
		async execute(_id, { thread }, _signal, _onUpdate, ctx) {
			const c = synced(ctx);
			if (!c) throw new Error("life is off in this session");
			if (thread) {
				// The sibling's system prompt is not its work; a fresh session's first run would carry it whole.
				const sibling = raw(await present(id!).readRun(thread)).filter((m) => (m as { role: string }).role !== "system");
				return { content: [{ type: "text", text: sibling.length ? JSON.stringify(sibling, null, 2) : "(no unfinished run there)" }], details: { upTo: c.T } };
			}
			const text = c.msgs.slice(run?.T ?? c.T).map((m) => line(c.b, [0, m.pos], c.resolve([0, m.pos]) ?? source(m))).join("\n");
			return { content: [{ type: "text", text: text || "(nothing new)" }], details: { upTo: c.T } };
		},
	});
	pi.registerTool({
		name: "zoom", label: "zoom",
		description: "Open line id+n into the lines under it; n = 1 gives message id whole, anywhere in the committed life.",
		parameters: Type.Object({ id: Type.Integer({ description: "First message of the line." }), n: Type.Integer({ description: "How many messages it covers." }) }),
		async execute(_id, params, _signal, _onUpdate, ctx) {
			const c = synced(ctx);
			if (!c) throw new Error("life is off in this session");
			const p = nodeAt(c.b, params.id, params.n, c.T);
			if (typeof p === "string") throw new Error(p);
			if (p[0] === 0) {
				const m = c.msgs[params.id]!;
				return { content: [{ type: "text", text: params.id + " " + m.kind + "@" + m.place + " " + m.date + "\nsource: " + m.source + "\nmodel: " + m.model + "\n" + m.text }], details: { id: params.id, source: m.source, model: m.model } };
			}
			return { content: [{ type: "text", text: children(c.b, p).map((q) => line(c.b, q, c.resolve(q) ?? PLACEHOLDER)).join("\n") }], details: { id: params.id, n: params.n } };
		},
	});
	pi.registerTool({
		name: "date", label: "date", description: "The date and time of message id, anywhere in the committed life.",
		parameters: Type.Object({ id: Type.Integer() }),
		async execute(_id, { id: pos }, _signal, _onUpdate, ctx) {
			const c = synced(ctx);
			if (!c) throw new Error("life is off in this session");
			const m = c.msgs[pos];
			if (!m) throw new Error("the life has " + c.T + " messages");
			return { content: [{ type: "text", text: m.date }], details: { id: pos } };
		},
	});
	return {
		name: NAME, owns: ["compaction", "context"], renderer, budget: () => Infinity,
		enabled: (ctx) => !!attachment(ctx), required: () => true,
		tools: ["hold", "catch_up", "zoom", "date"],
		prompt: (_e, ctx) => PROMPT(settings(ctx.cwd).fanout),
		request: (payload) => markView(payload),
		async context(_messages, ctx) {
			const c = synced(ctx);
			if (!c) return;
			const cfg = settings(ctx.cwd), branch = branchOf(ctx);
			if (!run) await open(ctx, runStart(branch));
			const current = run!;
			const fixView = () => {
				current.lines = viewAt(id!, c, cfg, current.T);
				current.view = { role: "user", content: chatParts(current.lines), timestamp: 0 } as AgentMessage;
			};
			if (!current.view) { await c.idle(current.T, cfg.waitSeconds * 1000); fixView(); }
			let tail = raw(branch.slice(current.boundary));
			if (Buffer.byteLength(JSON.stringify(tail)) > cfg.tailBytes) {
				const k = safeBoundary(branch, current.boundary);
				if (k > current.boundary) {
					// Commit first. Only then may these entries disappear from the raw tail.
					append(ctx, branch.slice(0, k)); synced(ctx);
					const T = c.T;
					// Earlier history still unsummarized (a sibling's lease, say) was waited for at this run's start: don't wait again at every request.
					if (c.summarized() >= current.T) {
						await c.idle(T, cfg.waitSeconds * 1000);
						if (c.summarized() >= T) {
							current.boundary = k; current.T = T; fixView();
							tail = raw(branch.slice(k));
						}
					}
				}
			}
			const pinned: AgentMessage[] = [];
			if (current.boundary > current.start) for (const e of branch.slice(current.start, current.boundary)) {
				if (e.type === "message" && e.message.role === "assistant") break;
				pinned.push(...sessionEntryToContextMessages(e));
			}
			return [current.view!, current.present, ...pinned, ...tail];
		},
	};
}
