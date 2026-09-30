import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { buildSessionContext, convertToLlm, sessionEntryToContextMessages } from "@earendil-works/pi-coding-agent";
import type { Context } from "@earendil-works/pi-ai";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { compareCheckpoint, logAttempt, saveCapture, type CheckpointCapture } from "./experiment.ts";
import { join } from "node:path";
import { focus, supervising, cacheIdleSeconds } from "./hibernate.ts";
import { trimImages, CHECKPOINT_BYTES } from "./images.ts";
import { KIND, elideCold, splitCheckpoint, claims, expandMemory, instruction, memoryOf, parseBlock, previousBlocks, renderMemory, roughTokens, sourceEntries, tailChoices, visibleEntries } from "./core.ts";

interface Elide { enabled: boolean; idleSeconds: Record<string, number>; minTokens: number; keepTurns: number }
/**
 * Seconds of inactivity after which each provider's prompt cache is assumed expired, erring long (under-eliding).
 * Anthropic/xAI: 5 min TTL refreshed on hit (Anthropic 1h under long retention). OpenAI: "5-10 minutes of inactivity,
 * up to one hour" in memory, 24h under long retention. Unpublished or best-effort caches (DeepSeek: hours to days;
 * Z.ai, Gemini implicit, routers) fall back to a day. Pi requests long retention via PI_CACHE_RETENTION=long.
 */
function cacheSeconds(long: boolean): Record<string, number> {
	const anthropic = long ? 3630 : 330, openai = long ? 86700 : 3660;
	return { default: 86400, anthropic, "amazon-bedrock": anthropic, xai: 330, openai, "openai-codex": openai, "azure-openai-responses": openai };
}
interface Hibernate { enabled: boolean; minTokens: number }
interface Settings { hibernate?: Partial<Hibernate>; journal?: boolean; elide?: Partial<Omit<Elide, "idleSeconds">> & { idleSeconds?: number | Record<string, number> }; enabled?: boolean; memoryTokens?: number; rewriteTokens?: number; blockTokens?: number; keepRecentTokens?: number; maxOutputTokens?: number }
export function settings(cwd: string): Required<Settings> & { elide: Elide; hibernate: Hibernate } {
	const read = (path: string): Settings => {
		try { return JSON.parse(readFileSync(path, "utf8")).memory ?? {}; }
		catch (e: any) { if (e.code === "ENOENT") return {}; throw e; }
	};
	const s = { enabled: true, journal: true, memoryTokens: 12000, rewriteTokens: 6000, blockTokens: 2000, keepRecentTokens: 2000, maxOutputTokens: 12000,
		...read(join(homedir(), ".pi/agent/settings.json")), ...read(join(cwd, ".pi/settings.json")) };
	for (const k of ["memoryTokens", "rewriteTokens", "blockTokens", "keepRecentTokens", "maxOutputTokens"] as const)
		if (!Number.isFinite(s[k]) || s[k] < 1) throw new Error(`memory.${k} must be positive`);
	if (s.rewriteTokens >= s.memoryTokens) throw new Error("memory.rewriteTokens must be below memory.memoryTokens");
	const idle = s.elide?.idleSeconds;
	const elide = { enabled: true, minTokens: 500, keepTurns: 1, ...s.elide,
		idleSeconds: typeof idle === "number" ? { default: idle } : { ...cacheSeconds(process.env.PI_CACHE_RETENTION === "long"), ...idle } };
	for (const k of ["minTokens", "keepTurns"] as const)
		if (!Number.isFinite(elide[k]) || elide[k] < 0) throw new Error(`memory.elide.${k} must be nonnegative`);
	for (const [k, v] of Object.entries(elide.idleSeconds))
		if (!Number.isFinite(v) || v < 0) throw new Error(`memory.elide.idleSeconds.${k} must be nonnegative`);
	const hibernate = { enabled: true, minTokens: 4000, ...s.hibernate };
	for (const k of ["minTokens"] as const)
		if (!Number.isFinite(hibernate[k]) || hibernate[k] < 0) throw new Error(`memory.hibernate.${k} must be nonnegative`);
	return { ...s, elide, hibernate };
}
interface Snapshot { session: string; leaf: string | null; model: string; context: Context }
const modelKey = (ctx: ExtensionContext) => `${ctx.model?.provider}/${ctx.model?.id}`;
function elide(messages: any[], branch: any[], s: ReturnType<typeof settings>) {
	return s.elide.enabled ? elideCold(messages, branch, { idleMs: p => (s.elide.idleSeconds[p] ?? s.elide.idleSeconds.default) * 1000, minTokens: s.elide.minTokens, keepTurns: s.elide.keepTurns }) : { messages, elided: 0 };
}
function tools(pi: ExtensionAPI) {
	const all = new Map(pi.getAllTools().map(t => [t.name, t]));
	return pi.getActiveTools().map(name => {
		const t = all.get(name);
		if (!t) throw new Error(`Missing active tool schema: ${name}`);
		return { name: t.name, description: t.description, parameters: t.parameters };
	});
}

const REGISTER = "compaction-om-v11";
const BLOCKED = /reverse engineering|duplicating model outputs/i;

export default function memoryExtension(pi: ExtensionAPI) {
	let snapshot: Snapshot | undefined;
	let busy = false;
	let forceRewrite = false;
	let elidedCount = 0;
	let hibernating = false;
	let captureRequests = false;
	// Pi retires this extension instance before invalidating its contexts. Late
	// agent_settled delivery must not read even a property of the retired ctx.
	let retired = false;
	// Invalidate callbacks that may already be queued when a session event cancels the timer.
	let hibernateToken: object | undefined;
	let idleTimer: ReturnType<typeof setTimeout> | undefined;
	const cancelHibernate = () => { hibernateToken = undefined; clearTimeout(idleTimer); idleTimer = undefined; };
	pi.on("agent_start", cancelHibernate);
	pi.on("session_start", cancelHibernate);
	pi.on("session_shutdown", () => { retired = true; cancelHibernate(); });
	pi.on("model_select", cancelHibernate);
	pi.on("session_compact", cancelHibernate);
	pi.on("session_start", () => { snapshot = undefined; forceRewrite = false; elidedCount = 0; });
	pi.on("session_compact", () => { snapshot = undefined; });
	pi.on("context", (event, ctx) => {
		// Even when disabled, render already-persisted blocks identically.
		const branch = ctx.sessionManager.getBranch(), s = settings(ctx.cwd);
		const cold = elide(event.messages, branch, s);
		if (cold.elided > elidedCount) ctx.ui.notify(`Cache was cold: elided ${cold.elided - elidedCount} old tool outputs (${cold.elided} total)`, "info");
		elidedCount = cold.elided;
		const { messages } = trimImages({ systemPrompt: ctx.getSystemPrompt(), tools: tools(pi), messages: expandMemory(cold.messages, branch) });
		if (s.enabled) snapshot = {
			session: ctx.sessionManager.getSessionId(), leaf: ctx.sessionManager.getLeafId(), model: modelKey(ctx),
			context: structuredClone({ systemPrompt: ctx.getSystemPrompt(), messages: convertToLlm(messages), tools: tools(pi) }),
		};
		return { messages };
	});

	pi.on("session_before_compact", async (event, ctx) => {
		cancelHibernate();
		if (busy) return { cancel: true };
		busy = true;
		let output: string | undefined;
		try {
			const s = settings(ctx.cwd);
			if (!s.enabled) return;
			if (!ctx.model) throw new Error("No active memory model");
			const branch = event.branchEntries;
			const leaf = ctx.sessionManager.getLeafId();
			const session = ctx.sessionManager.getSessionId(), model = modelKey(ctx);
			const checkCurrent = () => {
				if (event.signal.aborted) throw new Error("Memory cancelled: request aborted");
				const current = ctx.sessionManager.getBranch();
				const originalLeaf = current.findIndex(e => e.id === leaf);
				// Extension bookkeeping (e.g. board cursors) advances the leaf without changing context.
				if (ctx.sessionManager.getSessionId() !== session || modelKey(ctx) !== model || originalLeaf < 0
					|| current.slice(originalLeaf + 1).some(e => e.type !== "custom"))
					throw new Error("Memory cancelled: session or conversation changed");
			};
			const visible = visibleEntries(branch);
			const choices = tailChoices(visible);
			let prior = s.journal ? previousBlocks(branch) : [];
			if (!s.journal) {
				forceRewrite = false;
				const tail = [...choices].reverse().find(c => {
					const entry = visible[c.index];
					return entry.type === "message" && entry.message.role === "user";
				});
				if (!tail) throw new Error("Empty-journal compaction requires a continuous tail starting at a user message");
				if (!sourceEntries(visible.slice(0, tail.index)).length && !previousBlocks(branch).length)
					throw new Error("Nothing to fold outside a continuous tail");
				checkCurrent();
				return { compaction: {
					summary: "", firstKeptEntryId: tail.id, tokensBefore: event.preparation.tokensBefore,
					details: { kind: KIND, blocks: [], operation: "empty-journal", generation: "none",
						...(hibernating ? { trigger: "hibernate" } : {}), prefixMode: "none",
						tail: { mode: "fixed-last-user-turn", firstKeptEntryId: tail.id, estimatedTokens: tail.tokens,
							targetTokens: s.keepRecentTokens, reason: "keep the latest user message and every later entry verbatim" },
						model, ms: 0 },
				} };
			}
			const rewrite = forceRewrite || roughTokens(renderMemory(prior)) >= s.memoryTokens;
			forceRewrite = false;
			if (!choices.length || (!rewrite && !choices.some(c => sourceEntries(visible.slice(0, c.index)).length)))
				throw new Error("Nothing to fold outside a continuous tail");
			let context: Context;
			let prefixMode = "reconstructed";
			const anchor = snapshot?.leaf ? branch.findIndex(e => e.id === snapshot!.leaf) : -1;
			const additions = anchor >= 0 ? branch.slice(anchor + 1) : [];
			if (snapshot && snapshot.session === ctx.sessionManager.getSessionId() && snapshot.model === modelKey(ctx)
				&& anchor >= 0 && !additions.some(e => e.type === "compaction" || e.type === "branch_summary")) {
				context = structuredClone(snapshot.context);
				context.messages.push(...convertToLlm(additions.flatMap(sessionEntryToContextMessages)));
				prefixMode = "captured";
			} else {
				context = { systemPrompt: ctx.getSystemPrompt(), tools: tools(pi), messages: convertToLlm(expandMemory(elide(buildSessionContext(branch).messages, branch, s).messages, branch)) };
			}
			const selfAuthored = context.messages.every((m: any) => m.role !== "assistant" || (m.provider === ctx.model!.provider && m.model === ctx.model!.id));
			const stream = (ctx.modelRegistry as any).streamSimple;
			if (typeof stream !== "function") throw new Error("Memory requires Pi's modelRegistry.streamSimple (update Pi)");
			const started = Date.now();
			let response: any, register = REGISTER;
			const timestamp = Date.now();
			const requests = [false, true].map(impersonal => trimImages({ ...context, messages: [...context.messages, { role: "user" as const, content: instruction(prior, sourceEntries(visible), rewrite, rewrite ? s.rewriteTokens : s.blockTokens, event.customInstructions, { choices, target: s.keepRecentTokens }, selfAuthored, impersonal), timestamp }] }, CHECKPOINT_BYTES)) as [Context, Context];
			const options = { sessionId: session, reasoning: pi.getThinkingLevel() === "off" ? undefined : pi.getThinkingLevel(), maxTokens: Math.min(s.maxOutputTokens, ctx.model.maxTokens || s.maxOutputTokens) };
			const capture: CheckpointCapture = { version: 1, session, leaf, model, trigger: hibernating ? "hibernate" : "compact", register, options, requests };
			const dir = ctx.sessionManager.getSessionDir?.() ?? tmpdir();
			const captureFile = join(dir, `memory-checkpoint-${session}-${timestamp}.json`);
			let captured = false;
			const save = () => {
				if (captured) return;
				try { saveCapture(captureFile, capture); captured = true; ctx.ui.notify(`Memory checkpoint captured: ${captureFile}`, "info"); }
				catch (error) { ctx.ui.notify(`Memory capture failed: ${error}`, "warning"); }
			};
			if (captureRequests) save();
			for (const impersonal of [false, true]) {
				const request = requests[impersonal ? 1 : 0], attemptStarted = Date.now();
				try { response = await stream.call(ctx.modelRegistry, ctx.model, request, { ...options, signal: event.signal }).result(); }
				catch (error) { response = { stopReason: "error", errorMessage: String(error), content: [] }; }
				try { logAttempt(join(dir, "memory-attempts.jsonl"), { session, leaf, model, trigger: capture.trigger, register, checkpoint: captureFile, attempt: impersonal ? 2 : 1 }, request, attemptStarted, response); }
				catch (error) { ctx.ui.notify(`Memory attempt logging failed: ${error}`, "warning"); }
				if (BLOCKED.test(response.errorMessage ?? "")) save();
				if (response.stopReason === "error" && response.content?.some((b: any) => b.text || b.thinking)) {
					// Partial output up to the block, for reviewing where the filter trips.
					const file = join(ctx.sessionManager.getSessionDir?.() ?? tmpdir(), `memory-blocked-${ctx.sessionManager.getSessionId()}-${Date.now()}.md`);
					writeFileSync(file, `register: ${register}\nerror: ${response.errorMessage}\noutput tokens: ${response.usage?.output ?? "?"}\nms: ${Date.now() - attemptStarted}\n\n${response.content.map((b: any) => b.type === "thinking" ? `<thinking>\n${b.thinking}\n</thinking>` : b.text ?? "").join("\n\n")}`, { mode: 0o600 });
					ctx.ui.notify(`Memory checkpoint partial output: ${file}`, "info");
				}
				if (impersonal || event.signal.aborted || !BLOCKED.test(response.errorMessage ?? "")) break;
				register = `${REGISTER}-fallback-impersonal`;
				ctx.ui.notify("Memory checkpoint blocked by provider filter; retrying in third/first-plural person", "warning");
			}
			checkCurrent();
			if (response.stopReason !== "stop" || response.content.some((b: any) => b.type === "toolCall"))
				throw new Error(`Memory generation did not finish cleanly: ${response.errorMessage ?? response.stopReason}`);
			const text = output = response.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
			const checkpoint = splitCheckpoint(text);
			const chosen = choices.find(c => c.id === checkpoint.tail);
			if (!chosen) throw new Error("Invalid tail start: begin with a `tail: ID` line naming a listed start");
			const kept = visible[chosen.index], folding = sourceEntries(visible.slice(0, chosen.index));
			if (!folding.length && !rewrite) throw new Error("Chosen tail leaves nothing to fold; context unchanged");
			prior = [...prior, ...visible.slice(0, chosen.index).flatMap(e => e.type === "branch_summary"
				? [{ id: `legacy-${e.id}`, timestamp: Date.parse(e.timestamp), covers: [], observations: [], reflections: [], legacy: e.summary }] : [])];
			const allowed = new Set(sourceEntries(visible).map(e => e.id));
			// Prior evidence remains addressable, but never across an unrelated branch.
			const branchIds = new Set(sourceEntries(branch).map(e => e.id));
			for (const c of claims(prior)) for (const id of c.sources) if (branchIds.has(id)) allowed.add(id);
			const block = parseBlock(checkpoint.text, allowed, prior, rewrite, folding.map(e => e.id));
			if (rewrite && roughTokens(renderMemory([block])) >= s.memoryTokens) throw new Error("Rewrite exceeds memory budget; old context retained");
			// Imported summaries cannot be safely dropped without original provenance.
			const blocks = [...(rewrite ? prior.filter(b => b.legacy !== undefined) : prior), block];
			return { compaction: {
				summary: renderMemory(blocks), firstKeptEntryId: kept.id, tokensBefore: event.preparation.tokensBefore,
				usage: response.usage,
				details: { kind: KIND, blocks, operation: rewrite ? "rewrite" : "append", ...(hibernating ? { trigger: "hibernate" } : {}), prefixMode, register, selfAuthored,
					tail: { mode: "model-contiguous", firstKeptEntryId: kept.id, estimatedTokens: chosen.tokens, targetTokens: s.keepRecentTokens },
					model: modelKey(ctx), ms: Date.now() - started, usage: response.usage },
			} };
		} catch (error) {
			let message = error instanceof Error ? error.message : String(error);
			if (output !== undefined) {
				const file = join(ctx.sessionManager.getSessionDir?.() ?? tmpdir(), `memory-failed-${ctx.sessionManager.getSessionId()}-${Date.now()}.md`);
				writeFileSync(file, output);
				message += ` (output: ${file})`;
			}
			// A filter block on both prompts is about the session, not the checkpoint: let Pi's own summarizer (a separate, serialized request) try.
			if (BLOCKED.test(message) && !event.signal.aborted) {
				ctx.ui.notify("Memory checkpoint blocked by provider filter; falling back to Pi's native compaction", "warning");
				return;
			}
			// Otherwise never fall through to native summarization after an invalid/failed checkpoint.
			ctx.ui.notify(`Memory not compacted: ${message}`, "warning");
			return { cancel: true };
		} finally { busy = false; forceRewrite = false; hibernating = false; }
	});

	// Preserve the warm prefix until the supervisor has actually been idle for a cache lifetime.
	pi.on("agent_settled", (_event, ctx) => {
		cancelHibernate();
		if (retired) return;
		const s = settings(ctx.cwd);
		if (!s.enabled || !s.hibernate.enabled || busy || !ctx.model || ctx.hasPendingMessages()) return;
		const session = ctx.sessionManager.getSessionId(), model = modelKey(ctx);
		if (!supervising(session).length) return;
		const token = {};
		hibernateToken = token;
		idleTimer = setTimeout(() => {
			if (hibernateToken !== token) return;
			hibernateToken = undefined;
			idleTimer = undefined;
			const current = settings(ctx.cwd);
			if (!current.enabled || !current.hibernate.enabled || busy || !ctx.isIdle() || ctx.hasPendingMessages()
				|| ctx.sessionManager.getSessionId() !== session || modelKey(ctx) !== model) return;
			const jobs = supervising(session);
			if (!jobs.length) return;
			const foldable = tailChoices(visibleEntries(ctx.sessionManager.getBranch()))[0]?.tokens ?? 0;
			if (foldable < current.hibernate.minTokens) return;
			ctx.ui.notify(`Hibernating: folding ~${foldable} tokens while waiting on ${jobs.map(j => j.ticket).join(", ")}`, "info");
			hibernating = true;
			ctx.compact({ customInstructions: focus(jobs), onError: () => { hibernating = false; } });
		}, cacheIdleSeconds(ctx.model.provider) * 1000);
		idleTimer.unref?.();
	});

	pi.registerCommand("memory", {
		description: "Append-only memory: status | fold [focus] | rewrite [focus] | capture | compare FILE [rounds]",
		handler: async (args, ctx) => {
			const [command = "status", ...focus] = args.trim().split(/\s+/).filter(Boolean);
			if (args.trim() === "capture") {
				captureRequests = !captureRequests;
				ctx.ui.notify(`Capture all memory checkpoint requests: ${captureRequests ? "on" : "off"}. Blocked requests are always captured locally.`, "info");
				return;
			}
			if (args.startsWith("compare ")) {
				if (busy) { ctx.ui.notify("Memory is busy", "warning"); return; }
				const match = args.match(/^compare\s+(.+?)(?:\s+([1-5]))?$/)!;
				const file = match[1], rounds = Number(match[2] ?? 1);
				busy = true;
				try {
					const capture = JSON.parse(readFileSync(file, "utf8")) as CheckpointCapture;
					if (capture.version !== 1 || capture.requests?.length !== 2 || capture.model !== modelKey(ctx)) throw new Error("Capture requires its original model and two request variants");
					const output = `${file}.compare-${Date.now()}.jsonl`;
					ctx.ui.notify(`Comparing ${rounds} paired rounds (${rounds * 2} model calls); results: ${output}`, "info");
					await compareCheckpoint(capture, rounds, (request, options) => (ctx.modelRegistry as any).streamSimple(ctx.model, request, { ...options, signal: AbortSignal.timeout(180_000) }).result(),
						(variant, round, request, started, response) => {
							logAttempt(output, { checkpoint: file, model: capture.model, trigger: capture.trigger, variant, round }, request, started, response);
							writeFileSync(`${output}.${round}-${variant}.json`, JSON.stringify(response), { mode: 0o600 });
							ctx.ui.notify(`${round}/${rounds} ${variant}: ${response.stopReason}${response.errorMessage ? ` — ${response.errorMessage}` : ""}`, "info");
						});
				} catch (error) { ctx.ui.notify(`Memory comparison failed: ${error}`, "warning"); }
				finally { busy = false; }
				return;
			}
			if (command === "fold" || command === "rewrite") {
				await ctx.waitForIdle();
				if (!settings(ctx.cwd).enabled) { ctx.ui.notify("Memory is disabled in settings", "warning"); return; }
				forceRewrite = command === "rewrite";
				ctx.compact({ customInstructions: focus.join(" ") || undefined,
					onComplete: () => { forceRewrite = false; }, onError: () => { forceRewrite = false; } });
				return;
			}
			const memory = memoryOf(ctx.sessionManager.getBranch()), blocks = memory?.blocks ?? [];
			ctx.ui.notify(`${blocks.length} memory blocks, ~${roughTokens(renderMemory(blocks))} tokens.${memory?.tail ? ` Last chosen tail: ~${memory.tail.estimatedTokens} tokens from ${memory.tail.firstKeptEntryId}.${memory.tail.reason ? ` ${memory.tail.reason}` : ""}` : ""} /memory fold | rewrite [focus]`, "info");
		},
	});
}
