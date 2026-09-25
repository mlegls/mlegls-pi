// connectome: Anima Labs' context-manager (https://github.com/anima-research/context-manager)
// as pi's memory/compaction backend. Every message pi would send is mirrored into a
// Chronicle store that belongs to an identity (default: one per cwd) rather than a session,
// and each LLM call's messages are replaced with the store's compiled view: recent history
// verbatim, older history as first-person memories the agent's own model wrote
// (AutobiographicalStrategy, kv-stable folding). pi's own compaction is cancelled.
//
// Settings ("connectome" in ~/.pi/agent/settings.json or <cwd>/.pi/settings.json):
//   identity      store name; default derived from cwd. Same identity = same continuing life.
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
import { existsSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

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
function keyOf(participant: string, blocks: Block[]): string {
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

interface Holder {
	ctx?: ExtensionContext;
	pi?: ExtensionAPI;
	agentName: string;
	log: string;
	aborts: Set<AbortController>;
}
interface Life {
	path: string;
	cm: ContextManager;
	holder: Holder;
	originals: Map<string, Message>; // keyOf -> original pi message
	ingested: Set<string>; // external ids `${entryId}:${i}`
}
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
			const messages = toPiMessages(req.messages, holder.agentName, model, undefined);
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
 *  unchanged; memories and truncated messages are rebuilt. */
function toPiMessages(nms: NMessage[], agentName: string, model: any, originals: Map<string, Message> | undefined): Message[] {
	const out: Message[] = [];
	const now = Date.now();
	for (const nm of nms) {
		const isAgent = nm.participant === agentName;
		const orig = originals?.get(keyOf(isAgent ? "" : HUMAN, nm.content));
		if (orig) {
			out.push(orig);
			continue;
		}
		if (isAgent) {
			const content: any[] = [];
			for (const b of nm.content) {
				if (b.type === "text") content.push({ type: "text", text: b.text });
				else if (b.type === "tool_use") content.push({ type: "toolCall", id: b.id, name: b.name, arguments: b.input });
			}
			if (!content.length) continue;
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
			continue;
		}
		let pending: any[] = [];
		const flush = () => {
			if (pending.length) out.push({ role: "user", content: pending, timestamp: now } as UserMessage);
			pending = [];
		};
		for (const b of nm.content) {
			if (b.type === "tool_result") {
				flush();
				const content = typeof b.content === "string" ? [{ type: "text", text: b.content }] : piContent(b.content);
				out.push({ role: "toolResult", toolCallId: b.toolUseId, toolName: b.toolName ?? "", content, isError: !!b.isError, timestamp: now } as ToolResultMessage);
			} else pending.push(...piContent([b]));
		}
		flush();
	}
	return out;
}

export default function (pi: ExtensionAPI) {
	let life: Life | undefined;
	let settings: Settings = {};
	let warned = false;

	const open = async (ctx: ExtensionContext) => {
		settings = readSettings(ctx.cwd);
		if (settings.enabled === false) return;
		const identity = settings.identity ?? slug(ctx.cwd);
		const root = settings.dir ?? join(homedir(), ".pi", "agent", "connectome");
		const path = join(root, identity);
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
				return;
			}
			LIB_LOG.path = join(path, "lib.log");
			l = { path, cm, holder, originals: new Map(), ingested: new Set() };
			reindex(l);
			LIVES.set(path, l);
		}
		l.holder.ctx = ctx;
		l.holder.pi = pi;
		life = l;
		ctx.ui.setStatus?.("connectome", `◈ ${identity.slice(-24)}`);
	};

	/** Rebuild id/original maps from the store's current branch. */
	const reindex = (l: Life) => {
		l.originals.clear();
		l.ingested.clear();
		for (const m of l.cm.getAllMessages()) {
			const ext = (m.metadata as any)?.external;
			if (ext?.source === SOURCE) l.ingested.add(ext.id);
			const pim = (m.metadata as any)?.pi as Message | undefined;
			if (pim) l.originals.set(keyOf(m.participant === l.holder.agentName ? "" : HUMAN, m.content as Block[]), pim);
		}
	};

	const ingest = (l: Life, ctx: ExtensionContext) => {
		for (const entry of ctx.sessionManager.getBranch()) {
			if (l.ingested.has(`${entry.id}:0`) || l.ingested.has(`${entry.id}:-`)) continue;
			const llm = convertToLlm(sessionEntryToContextMessages(entry));
			if (!llm.length) continue;
			llm.forEach((m, i) => {
				const b = toBlocks(m);
				if (!b || !b.blocks.length) return;
				const participant = m.role === "assistant" ? l.holder.agentName : b.participant;
				const id = `${entry.id}:${i}`;
				l.cm.addMessage(participant, b.blocks, {
					external: { source: SOURCE, id },
					pi: m,
					piSession: ctx.sessionManager.getSessionId(),
				});
				l.ingested.add(id);
				l.originals.set(keyOf(m.role === "assistant" ? "" : HUMAN, b.blocks), m);
			});
		}
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
		await open(ctx);
	});

	const trace = (l: Life, o: Record<string, unknown>) => {
		try {
			appendFileSync(join(l.path, "calls.jsonl"), JSON.stringify({ t: new Date().toISOString(), ...o }) + "\n");
		} catch {}
	};
	pi.on("context", async (event, ctx) => {
		const l = life;
		const model = ctx.model;
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
				reused: messages.filter((m) => [...l.originals.values()].includes(m)).length,
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

	// Chronicle owns forgetting; pi's compaction would summarize a view we already replace.
	// the final reply of a run has no following LLM call to carry it in
	pi.on("agent_end", async (_e, ctx) => {
		if (life) ingest(life, ctx);
	});
	pi.on("session_before_compact", async () => (life ? { cancel: true } : undefined));

	// /tree navigation = time travel in the life: branch the store at the newest message the
	// new leaf has in common with it.
	pi.on("session_tree", async (_e, ctx) => {
		const l = life;
		if (!l) return;
		const branch = ctx.sessionManager.getBranch();
		for (let i = branch.length - 1; i >= 0; i--) {
			const e = branch[i];
			const hits = [...l.ingested].filter((id) => id.startsWith(`${e.id}:`));
			if (!hits.length) continue;
			const last = hits.sort().at(-1)!;
			const found = l.cm.findMessageByExternalId(SOURCE, last);
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
		for (const ac of l.holder.aborts) ac.abort();
		for (let i = 0; i < 50 && l.cm.getPendingWork(); i++) await new Promise((r) => setTimeout(r, 100));
		LIVES.delete(l.path);
		try {
			l.cm.close();
		} catch {}
	});

	pi.registerCommand("connectome", {
		description: "connectome memory: store, sizes, summaries, pending work",
		handler: async (_args, ctx) => {
			const l = life;
			if (!l) return ctx.ui.notify("connectome: inactive this session", "info");
			const s: any = l.cm.stats();
			const lines = [
				`store ${l.path}`,
				`branch ${l.cm.currentBranch().name}  messages ${l.cm.getMessageCount()}  max summary level ${l.cm.getMaxSummaryLevel()}`,
				`pending ${l.cm.getPendingWork()?.description ?? "none"}`,
				`stats ${JSON.stringify(s)}`,
				`render ${JSON.stringify(l.cm.getRenderStats())}`,
				`memory-write log ${l.holder.log}`,
			];
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});
}
