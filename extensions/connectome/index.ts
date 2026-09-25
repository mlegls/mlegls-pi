// connectome: Anima Labs' context-manager (https://github.com/anima-research/context-manager)
// as pi's memory/compaction backend. Every message pi would send is mirrored into a
// Chronicle store (a "life"): by default one per session, or a named one shared across sessions,
// and each LLM call's messages are replaced with the store's compiled view: recent history
// verbatim, older history as first-person memories the agent's own model wrote
// (AutobiographicalStrategy, kv-stable folding). pi's own compaction is cancelled.
//
// Settings ("connectome" in ~/.pi/agent/settings.json or <cwd>/.pi/settings.json):
//   identity      default life name (see README: lives are <project>/<name>/<model>; precedence is
//                 /connectome use, PI_CONNECTOME, this, then "@session": a life of this session only)
//   dir           store root; default ~/.pi/agent/connectome
//   agentName     participant name memories are voiced as; default "Assistant"
//   budgetRatio   fraction of the model's context window the prompt (system, tools, view) may use; default 0.5
//   budgetTokens  absolute prompt budget; overrides budgetRatio
//   reserveForResponse  default 16384
//   strategy      passthrough overrides for AutobiographicalConfig
//
// Memory writes go through a Membrane stand-in that calls the session's current model via
// pi's model registry, with the session id, so they can share the live prompt cache.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { convertToLlm, sessionEntryToContextMessages } from "@earendil-works/pi-coding-agent";
import type { AssistantMessage, Message, ToolResultMessage, UserMessage } from "@earendil-works/pi-ai";
import { AutobiographicalStrategy, ContextManager, OverBudgetError } from "@animalabs/context-manager";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

type Block = any; // membrane ContentBlock
type NMessage = { participant: string; content: Block[] };

const HUMAN = "User";
const SOURCE = "pi";

interface Settings {
	identity?: string;
	dir?: string;
	agentName?: string;
	budgetRatio?: number;
	budgetTokens?: number;
	reserveForResponse?: number;
	strategy?: Record<string, unknown>;
	enabled?: boolean;
}

function readSettings(cwd: string): Settings {
	const read = (p: string) => {
		try {
			return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")).connectome ?? {}) : {};
		} catch {
			return {};
		}
	};
	const global = read(join(homedir(), ".pi", "agent", "settings.json"));
	const project = read(join(cwd, ".pi", "settings.json"));
	return { ...global, ...project, strategy: { ...global.strategy, ...project.strategy } };
}

function slug(cwd: string): string {
	return cwd.replace(/^\/+/, "").replace(/[^A-Za-z0-9._-]+/g, "-");
}

// ── pi-ai Message <-> membrane blocks ───────────────────────────────────────

function toBlocks(m: Message): { participant: string; blocks: Block[] } | null {
	if (m.role === "user") {
		const c: any[] = typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content;
		return {
			participant: HUMAN,
			blocks: c.map((b: any) =>
				b.type === "image" ? { type: "image", source: { type: "base64", data: b.data, mediaType: b.mimeType } } : { type: "text", text: b.text },
			),
		};
	}
	if (m.role === "toolResult") {
		const content = m.content.map((b: any) =>
			b.type === "image" ? { type: "image", source: { type: "base64", data: b.data, mediaType: b.mimeType } } : { type: "text", text: b.text },
		);
		return { participant: HUMAN, blocks: [{ type: "tool_result", toolUseId: m.toolCallId, toolName: m.toolName, content, isError: m.isError || undefined }] };
	}
	if (m.role === "assistant") {
		const blocks: Block[] = [];
		for (const b of m.content as any[]) {
			if (b.type === "text") blocks.push({ type: "text", text: b.text });
			else if (b.type === "thinking" && !b.redacted) blocks.push({ type: "thinking", thinking: b.thinking });
			else if (b.type === "toolCall") blocks.push({ type: "tool_use", id: b.id, name: b.name, input: b.arguments });
		}
		return { participant: "", blocks };
	}
	return null; // system messages belong to pi
}

/** Key for mapping compiled/raw blocks back to pi's original message. Thinking is ignored:
 *  context-manager strips it in places, and the original (with signatures) is what pi sent live. */
export function keyOf(participant: string, blocks: Block[]): string {
	const norm = blocks.filter((b) => b.type !== "thinking" && b.type !== "redacted_thinking");
	return createHash("sha256").update(participant + "\0" + canonical(norm)).digest("hex");
}

/** Chronicle round-trips JSON with sorted keys and without undefined fields. */
function canonical(v: unknown): string {
	return JSON.stringify(v, (_k, x) =>
		x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x,
	);
}

function piContent(blocks: Block[]): any[] {
	return blocks.flatMap((b): any[] =>
		b.type === "text"
			? [{ type: "text", text: b.text }]
			: b.type === "image" && b.source?.type === "base64"
				? [{ type: "image", data: b.source.data, mimeType: b.source.mediaType }]
				: [],
	);
}

// ── record shared across reloads / session replacement (store lock is per process) ──

function remember(l: { originals: Originals }, key: string, m: Message[]) {
	const all = l.originals.get(key);
	if (all) all.push(m);
	else l.originals.set(key, [m]);
}
interface Holder {
	ctx?: ExtensionContext;
	pi?: ExtensionAPI;
	agentName: string;
	log: string;
	aborts: Set<AbortController>;
	/** the life's originals, so memory-write requests replay history exactly as pi sent it live */
	originals?: Originals;
}
interface Life {
	path: string;
	cm: ContextManager;
	holder: Holder;
	/** keyOf -> pi's originals with that content, oldest first. Identical content recurs ("ok",
	 *  repeated questions), and each original carries its own provider item ids. An original is
	 *  a group: a batch of pi toolResult messages is stored as one message (see ingest). */
	originals: Originals;
	/** pi ids `${entryId}:${i}` -> the store message's external id (the first id of its group) */
	ingested: Map<string, string>;
}
type Originals = Map<string, Message[][]>;
const LIVES: Map<string, Life> = ((globalThis as any)[Symbol.for("mlegls.connectome.lives")] ??= new Map());

/** context-manager logs diagnostics straight to the console (~100 call sites), which would
 *  draw over the TUI and pollute print/json/rpc stdout. Calls originating in @animalabs code
 *  go to <life>/lib.log instead. Installed once per process. */
const LIB_LOG: { path?: string } = ((globalThis as any)[Symbol.for("mlegls.connectome.liblog")] ??= (() => {
	const target: { path?: string } = {};
	for (const level of ["log", "info", "warn", "error", "debug"] as const) {
		const orig = console[level].bind(console);
		console[level] = (...args: unknown[]) => {
			if (!new Error().stack?.includes("/@animalabs/")) return orig(...args);
			if (!target.path) return;
			try {
				const text = args.map((a) => (typeof a === "string" ? a : a instanceof Error ? a.stack : JSON.stringify(a))).join(" ");
				appendFileSync(target.path, `${new Date().toISOString()} ${level} ${text}\n`);
			} catch {}
		};
	}
	return target;
})());

function membraneFor(holder: Holder) {
	return {
		async complete(req: any): Promise<any> {
			const ctx = holder.ctx;
			const model = ctx?.model;
			if (!ctx || !model) throw new Error("connectome: no active model for memory formation");
			const messages = toPiMessages(req.messages, holder.agentName, model, holder.originals);
			const tools = (req.tools ?? []).map((t: any) => ({ name: t.name, description: t.description, parameters: t.inputSchema }));
			const level = holder.pi?.getThinkingLevel();
			const ac = new AbortController();
			holder.aborts.add(ac);
			const t0 = Date.now();
			try {
				const out: AssistantMessage = await (ctx.modelRegistry as any)
					.streamSimple(model, { systemPrompt: req.system, messages, tools: tools.length ? tools : undefined } as any, {
						reasoning: level && level !== "off" ? level : undefined,
						sessionId: ctx.sessionManager.getSessionId(),
						maxTokens: req.config?.maxTokens,
						signal: ac.signal,
					} as any)
					.result();
				const u = out.usage;
				appendFileSync(
					holder.log,
					JSON.stringify({ t: new Date().toISOString(), model: `${model.provider}/${model.id}`, ms: Date.now() - t0, stop: out.stopReason, input: u?.input, cacheRead: u?.cacheRead, cacheWrite: u?.cacheWrite, output: u?.output, cost: u?.cost?.total, err: out.errorMessage }) + "\n",
				);
				if (out.stopReason === "error" || out.stopReason === "aborted") throw new Error(out.errorMessage ?? `memory write ${out.stopReason}`);
				const content = (out.content as any[]).filter((b) => b.type === "text").map((b) => ({ type: "text", text: b.text }));
				const stopReason = out.stopReason === "length" ? "max_tokens" : out.stopReason === "toolUse" ? "tool_use" : "end_turn";
				const inputTokens = (u?.input ?? 0) + (u?.cacheRead ?? 0) + (u?.cacheWrite ?? 0);
				return {
					content,
					rawAssistantText: content.map((b) => b.text).join(""),
					toolCalls: [],
					toolResults: [],
					stopReason,
					usage: { inputTokens, outputTokens: u?.output ?? 0 },
					details: {
						usage: { inputTokens, outputTokens: u?.output ?? 0, cacheCreationTokens: u?.cacheWrite ?? 0, cacheReadTokens: u?.cacheRead ?? 0 },
						model: { actual: model.id, provider: model.provider },
					},
				};
			} finally {
				holder.aborts.delete(ac);
			}
		},
	};
}

/** Compiled membrane messages -> pi messages. Raw messages come back as pi's originals when
 *  unchanged; memories and truncated messages are rebuilt. Folding consumes history from the
 *  front, so the n surviving copies of some content are matched to its n newest originals. */
export function toPiMessages(nms: NMessage[], agentName: string, model: any, originals: Originals | undefined): Message[] {
	const out: Message[] = [];
	const now = Date.now();
	// pi-ai never replays aborted/errored assistant turns, but context-manager's tool pairing
	// stubs results for their unanswered tool calls; those results would reach the API orphaned.
	const dropped = new Set<string>();
	const keys = nms.map((nm) => keyOf(nm.participant === agentName ? "" : HUMAN, nm.content));
	const remaining = new Map<string, number>();
	for (const k of keys) remaining.set(k, (remaining.get(k) ?? 0) + 1);
	nms.forEach((nm, i) => {
		const isAgent = nm.participant === agentName;
		const all = originals?.get(keys[i]);
		const left = remaining.get(keys[i])!;
		remaining.set(keys[i], left - 1);
		const orig = all && all.length >= left ? all[all.length - left] : undefined;
		if (orig) {
			for (const m of orig)
				if (m.role === "assistant" && (m.stopReason === "aborted" || m.stopReason === "error"))
					for (const b of m.content) if (b.type === "toolCall") dropped.add(b.id);
			out.push(...orig.filter((m) => !(m.role === "toolResult" && dropped.has(m.toolCallId))));
			return;
		}
		if (isAgent) {
			const content: any[] = [];
			for (const b of nm.content) {
				if (b.type === "text") content.push({ type: "text", text: b.text });
				else if (b.type === "tool_use") content.push({ type: "toolCall", id: b.id, name: b.name, arguments: b.input });
			}
			if (!content.length) return;
			out.push({
				role: "assistant",
				content,
				api: model.api,
				provider: model.provider,
				model: model.id,
				usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
				stopReason: content.some((c) => c.type === "toolCall") ? "toolUse" : "stop",
				timestamp: now,
			} as AssistantMessage);
			return;
		}
		let pending: any[] = [];
		const flush = () => {
			if (pending.length) out.push({ role: "user", content: pending, timestamp: now } as UserMessage);
			pending = [];
		};
		for (const b of nm.content) {
			if (b.type === "tool_result") {
				if (dropped.has(b.toolUseId)) continue;
				flush();
				const content = typeof b.content === "string" ? [{ type: "text", text: b.content }] : piContent(b.content);
				out.push({ role: "toolResult", toolCallId: b.toolUseId, toolName: b.toolName ?? "", content, isError: !!b.isError, timestamp: now } as ToolResultMessage);
			} else pending.push(...piContent([b]));
		}
		flush();
	});
	return out;
}

export default function (pi: ExtensionAPI) {
	let life: Life | undefined;
	let settings: Settings = {};
	let warned = false;
	/** Name of the life this session should live in; null = off. A name is resolved per project
	 *  and per model (see lifePath), so switching models moves the session to that model's life.
	 *  Resolved at session start and opened lazily at the first LLM call, so a `/connectome use`
	 *  before then never touches the default life. */
	let wanted: string | null = null;
	let lastCtx: ExtensionContext | undefined;
	/** The default: a life that belongs to this session only (resume keeps it; /new starts another). */
	const SESSION = "@session";
	const SESSIONS_DIR = "_sessions";

	const CHOICE = "connectome-identity";

	/** Precedence: an in-session choice (persisted in the session, so resume keeps it), then
	 *  PI_CONNECTOME from whoever launched pi ("off" or a name), then settings, then this session's own life. */
	const resolve = (ctx: ExtensionContext): string | null => {
		settings = readSettings(ctx.cwd);
		const chosen = ctx.sessionManager
			.getEntries()
			.filter((e: any) => e.type === "custom" && e.customType === CHOICE)
			.at(-1) as any;
		// `/connectome default` records { default: true }: fall through as if nothing was chosen
		if (chosen && !chosen.data?.default) return chosen.data?.identity ?? null;
		return fallback();
	};
	/** What a session gets without an in-session choice. */
	const fallback = (): string | null => {
		const env = process.env.PI_CONNECTOME;
		if (env) return env === "off" ? null : env;
		if (settings.enabled === false) return null;
		return settings.identity ?? SESSION;
	};

	/** The project is the git common dir's parent, so worktrees of one repo share lives. */
	const projectDir = (ctx: ExtensionContext) => {
		let root = ctx.cwd;
		try {
			const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: ctx.cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
			root = dirname(common);
		} catch {}
		return slug(root);
	};

	const storeRoot = () => settings.dir ?? join(homedir(), ".pi", "agent", "connectome");

	/** <root>/<project>/<name>/<model>; a name starting with "/" is project-independent:
	 *  <root>/_global/<name>/<model>; "@session" is <root>/<project>/_sessions/<session id>/<model>. */
	const lifePath = (ctx: ExtensionContext, name: string) => {
		const model = slug(ctx.model?.id ?? "model");
		return name.startsWith("/")
			? join(storeRoot(), "_global", name.slice(1), model)
			: name === SESSION
				? join(storeRoot(), projectDir(ctx), SESSIONS_DIR, slug(ctx.sessionManager.getSessionId()), model)
				: join(storeRoot(), projectDir(ctx), name, model);
	};

	const release = async (l: Life) => {
		for (const ac of l.holder.aborts) ac.abort();
		for (let i = 0; i < 50 && l.cm.getPendingWork(); i++) await new Promise((r) => setTimeout(r, 100));
		LIVES.delete(l.path);
		try {
			l.cm.close();
		} catch {}
	};

	const showStatus = (ctx: ExtensionContext) =>
		ctx.ui.setStatus?.("connectome", wanted ? `◈ ${wanted}${life ? "" : " …"}` : "◇ off");

	const activate = async (ctx: ExtensionContext, name: string) => {
		const path = lifePath(ctx, name);
		const agentName = settings.agentName ?? "Assistant";
		let l = LIVES.get(path);
		if (!l) {
			mkdirSync(path, { recursive: true });
			const holder: Holder = { agentName, log: join(path, "memory-writes.jsonl"), aborts: new Set() };
			const model = ctx.model;
			const strategy = new AutobiographicalStrategy({
				headWindowTokens: 4000,
				recentWindowTokens: 30000,
				maxMessageTokens: 10000,
				autoTickOnNewMessage: true,
				// the library default counts only text toward chunk size; for a coding agent the bulk is tool I/O,
				// so chunks of tool calls would never close
				attachmentsIgnoreSize: false,
				adaptiveResolution: true,
				foldingStrategy: "kv-stable",
				summaryParticipant: agentName,
				compressionModel: model ? `${model.provider}/${model.id}` : "unknown",
				...settings.strategy,
			} as any);
			let cm: ContextManager;
			try {
				cm = await ContextManager.open({ path: join(path, "store"), strategy, membrane: membraneFor(holder) as any });
			} catch (e) {
				ctx.ui.notify(`connectome: can't open ${path} (${(e as Error).message}); using pi's own context this session`, "warning");
				wanted = null;
				showStatus(ctx);
				return;
			}
			LIB_LOG.path = join(path, "lib.log");
			l = { path, cm, holder, originals: new Map(), ingested: new Map() };
			holder.originals = l.originals;
			reindex(l);
			LIVES.set(path, l);
		}
		l.holder.ctx = ctx;
		l.holder.pi = pi;
		life = l;
		showStatus(ctx);
	};

	/** Rebuild id/original maps from the store's current branch. */
	const reindex = (l: Life) => {
		l.originals.clear();
		l.ingested.clear();
		for (const m of l.cm.getAllMessages()) {
			const ext = (m.metadata as any)?.external;
			if (ext?.source === SOURCE) for (const id of ext.ids ?? [ext.id]) l.ingested.set(id, ext.id);
			const pim = (m.metadata as any)?.pi as Message | Message[] | undefined;
			if (pim) remember(l, keyOf(m.participant === l.holder.agentName ? "" : HUMAN, m.content as Block[]), Array.isArray(pim) ? pim : [pim]);
		}
	};

	// pi stores each tool result as its own message; context-manager assumes the Anthropic shape
	// (all results of a tool_use turn in the next message) when it cuts windows and chunks, so a
	// run of toolResults is ingested as one message. A run is complete by the time we see it:
	// ingest runs before an LLM call or at agent_end, never mid-batch.
	const ingest = (l: Life, ctx: ExtensionContext) => {
		const sid = ctx.sessionManager.getSessionId();
		let run: { ids: string[]; msgs: Message[]; blocks: Block[] } | undefined;
		const add = (participant: string, blocks: Block[], ids: string[], msgs: Message[]) => {
			l.cm.addMessage(participant, blocks, {
				external: { source: SOURCE, id: ids[0], ...(ids.length > 1 ? { ids } : {}) },
				pi: msgs.length > 1 ? msgs : msgs[0],
				piSession: sid,
			});
			for (const id of ids) l.ingested.set(id, ids[0]);
			remember(l, keyOf(participant === l.holder.agentName ? "" : HUMAN, blocks), msgs);
		};
		const flush = () => {
			if (run) add(HUMAN, run.blocks, run.ids, run.msgs);
			run = undefined;
		};
		for (const entry of ctx.sessionManager.getBranch()) {
			if (l.ingested.has(`${entry.id}:0`) || l.ingested.has(`${entry.id}:-`)) continue;
			const llm = convertToLlm(sessionEntryToContextMessages(entry));
			llm.forEach((m, i) => {
				const b = toBlocks(m);
				if (!b || !b.blocks.length) return;
				const id = `${entry.id}:${i}`;
				if (m.role === "toolResult") {
					run ??= { ids: [], msgs: [], blocks: [] };
					run.ids.push(id);
					run.msgs.push(m);
					run.blocks.push(...b.blocks);
					return;
				}
				flush();
				add(m.role === "assistant" ? l.holder.agentName : b.participant, b.blocks, [id], [m]);
			});
		}
		flush();
	};

	const syncPromptAndTools = (l: Life, ctx: ExtensionContext) => {
		l.cm.setSystemPrompt(ctx.getSystemPrompt());
		const all = new Map(pi.getAllTools().map((t) => [t.name, t]));
		l.cm.setToolDefinitions(
			pi
				.getActiveTools()
				.map((n) => all.get(n))
				.filter(Boolean)
				.map((t: any) => ({ name: t.name, description: t.description, inputSchema: t.parameters })),
		);
	};

	pi.on("session_start", async (_e, ctx) => {
		lastCtx = ctx;
		life = undefined;
		wanted = resolve(ctx);
		showStatus(ctx);
	});

	const trace = (l: Life, o: Record<string, unknown>) => {
		try {
			appendFileSync(join(l.path, "calls.jsonl"), JSON.stringify({ t: new Date().toISOString(), ...o }) + "\n");
		} catch {}
	};
	pi.on("context", async (event, ctx) => {
		const model = ctx.model;
		// a model switch moves the session into that model's life under the same name
		if (life && (!wanted || life.path !== lifePath(ctx, wanted))) {
			await release(life);
			life = undefined;
		}
		if (!life && wanted && model) await activate(ctx, wanted);
		const l = life;
		if (!l || !model) return;
		l.holder.ctx = ctx;
		try {
			ingest(l, ctx);
			// memory formation runs in the background; tick schedules it without blocking the turn
			l.cm.tick().catch((e) => trace(l, { tickError: String(e) }));
			syncPromptAndTools(l, ctx);
			const ratio = settings.budgetRatio ?? 0.5;
			// maxTokens is the window the view must fit in together with system/tools and the reply
			const prompt = settings.budgetTokens ?? Math.floor(model.contextWindow * ratio);
			const reserve = settings.reserveForResponse ?? 16384;
			const maxTokens = Math.min(model.contextWindow, prompt + reserve);
			const t0 = Date.now();
			// Folding lags ingestion (memories form in the background). If the backlog doesn't fit
			// the budget yet, borrow the rest of the window rather than drop to pi's own context.
			const compiled = await l.cm.compile({ maxTokens, reserveForResponse: reserve }).catch((e) => {
				if (!(e instanceof OverBudgetError) || maxTokens >= model.contextWindow) throw e;
				trace(l, { overBudget: (e as Error).message.slice(0, 200) });
				return l.cm.compile({ maxTokens: model.contextWindow, reserveForResponse: reserve });
			});
			const messages = toPiMessages(compiled.messages as NMessage[], l.holder.agentName, model, l.originals);
			trace(l, {
				piMessages: event.messages.length,
				compiled: compiled.messages.length,
				reused: messages.filter((m) => [...l.originals.values()].some((all) => all.some((g) => g.includes(m)))).length,
				chars: JSON.stringify(messages).length,
				maxTokens,
				ms: Date.now() - t0,
				pending: l.cm.getPendingWork()?.description,
			});
			if (!messages.length) return;
			// the current turn must survive compilation; if the tail differs, something upstream is off
			const last = event.messages.at(-1);
			if (last && !warned && JSON.stringify(messages.at(-1)) !== JSON.stringify(convertToLlm([last]).at(-1))) {
				warned = true;
				ctx.ui.notify("connectome: compiled tail differs from pi's latest message (see /connectome)", "warning");
			}
			return { messages };
		} catch (e) {
			trace(l, { error: (e as Error).stack ?? String(e) });
			ctx.ui.notify(`connectome: compile failed, using pi's context (${(e as Error).message})`, "error");
			return;
		}
	});

	// the final reply of a run has no following LLM call to carry it in
	pi.on("agent_end", async (_e, ctx) => {
		if (life) ingest(life, ctx);
	});
	// Chronicle owns forgetting; pi's compaction would summarize a view we already replace.
	pi.on("session_before_compact", async () => (life ? { cancel: true } : undefined));

	// /tree navigation = time travel in the life: branch the store at the newest message the
	// new leaf has in common with it.
	pi.on("session_tree", async (_e, ctx) => {
		const l = life;
		if (!l) return;
		const branch = ctx.sessionManager.getBranch();
		for (let i = branch.length - 1; i >= 0; i--) {
			const e = branch[i];
			const hits = [...l.ingested.keys()].filter((id) => id.startsWith(`${e.id}:`));
			if (!hits.length) continue;
			const last = hits.sort().at(-1)!;
			const found = l.cm.findMessageByExternalId(SOURCE, l.ingested.get(last)!);
			if (!found) break;
			await l.cm.switchBranch(l.cm.branchAt(found, `tree-${Date.now()}`));
			reindex(l);
			return;
		}
	});

	pi.on("session_shutdown", async (e) => {
		const l = life;
		life = undefined;
		if (!l || e.reason !== "quit") return; // keep the store open across /new, /resume, /reload
		await release(l);
	});

	pi.registerCommand("connectome", {
		description: "connectome memory: status | use <name> | off | default | list  (lives are per project/name/model; /name is project-independent)",
		getArgumentCompletions: (prefix) => {
			const [verb, arg = ""] = prefix.split(/\s+/, 2);
			if (!prefix.includes(" "))
				return ["use ", "off", "default", "list"].filter((v) => v.startsWith(verb)).map((v) => ({ value: v, label: v.trim() }));
			if (verb !== "use") return null;
			return [{ name: SESSION, models: [] as string[] }, ...listNames(lastCtx)]
				.filter((n) => n.name.startsWith(arg))
				.map((n) => ({ value: `use ${n.name}`, label: n.name, description: n.name === SESSION ? "this session only" : n.models.join(", ") }));
		},
		handler: async (args, ctx) => {
			const [verb, arg] = args.trim().split(/\s+/, 2);
			if (verb === "list")
				return ctx.ui.notify(listNames(ctx).map((n) => `${n.name}  (${n.models.join(", ")})`).join("\n") || "(no lives yet)", "info");
			if (verb === "use" || verb === "off" || verb === "default") {
				const next = verb === "off" ? null : verb === "default" ? ((settings = readSettings(ctx.cwd)), fallback()) : arg;
				if (verb === "use" && !arg) return ctx.ui.notify("usage: /connectome use <name>", "warning");
				// Messages already mirrored into the previous life stay there; the new life takes in
				// this session's whole branch at its next call.
				pi.appendEntry(CHOICE, verb === "default" ? { default: true } : { identity: next });
				const prev = life;
				life = undefined;
				wanted = next;
				if (prev && (!next || prev.path !== lifePath(ctx, next))) await release(prev);
				showStatus(ctx);
				return ctx.ui.notify(next ? `connectome: this session now lives in ${next}` : "connectome: off for this session", "info");
			}
			const l = life;
			if (!l) return ctx.ui.notify(`connectome: ${wanted ? `${wanted} (opens at the next model call)` : "off"} this session`, "info");
			const lines = [
				`name ${wanted}  model ${ctx.model?.id}`,
				`store ${l.path}`,
				`branch ${l.cm.currentBranch().name}  messages ${l.cm.getMessageCount()}  max summary level ${l.cm.getMaxSummaryLevel()}`,
				`pending ${l.cm.getPendingWork()?.description ?? "none"}`,
				`render ${JSON.stringify(l.cm.getRenderStats())}`,
				`memory-write log ${l.holder.log}`,
			];
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});

	/** Names with at least one model life: this project's, then project-independent ("/name"). */
	const listNames = (ctx: ExtensionContext | undefined): { name: string; models: string[] }[] => {
		const out: { name: string; models: string[] }[] = [];
		const ls = (dir: string) => {
			try {
				return readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
			} catch {
				return [];
			}
		};
		const walk = (base: string, rel: string, prefix: string, depth: number) => {
			const dir = join(base, rel);
			const models = ls(dir).filter((m) => existsSync(join(dir, m, "store")));
			if (models.length) out.push({ name: prefix + rel, models });
			if (depth < 3) for (const n of ls(dir)) if (!models.includes(n)) walk(base, rel ? `${rel}/${n}` : n, prefix, depth + 1);
		};
		// per-session lives are reachable only as @session from their own session
		if (ctx) for (const n of ls(join(storeRoot(), projectDir(ctx)))) if (n !== SESSIONS_DIR) walk(join(storeRoot(), projectDir(ctx)), n, "", 1);
		walk(join(storeRoot(), "_global"), "", "/", 0);
		return out.filter((n) => n.name && n.name !== "/").sort((a, b) => a.name.localeCompare(b.name));
	};
}
