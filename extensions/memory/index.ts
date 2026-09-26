import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { buildSessionContext, convertToLlm, sessionEntryToContextMessages } from "@earendil-works/pi-coding-agent";
import type { Context } from "@earendil-works/pi-ai";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { KIND, checkpointJson, claims, expandMemory, instruction, memoryOf, parseBlock, previousBlocks, renderMemory, roughTokens, sourceEntries, tailChoices, visibleEntries } from "./core.ts";

interface Settings { enabled?: boolean; memoryTokens?: number; rewriteTokens?: number; blockTokens?: number; keepRecentTokens?: number; maxOutputTokens?: number }
function settings(cwd: string): Required<Settings> {
	const read = (path: string): Settings => {
		try { return JSON.parse(readFileSync(path, "utf8")).memory ?? {}; }
		catch (e: any) { if (e.code === "ENOENT") return {}; throw e; }
	};
	const s = { enabled: true, memoryTokens: 12000, rewriteTokens: 6000, blockTokens: 2000, keepRecentTokens: 2000, maxOutputTokens: 12000,
		...read(join(homedir(), ".pi/agent/settings.json")), ...read(join(cwd, ".pi/settings.json")) };
	for (const k of ["memoryTokens", "rewriteTokens", "blockTokens", "keepRecentTokens", "maxOutputTokens"] as const)
		if (!Number.isFinite(s[k]) || s[k] < 1) throw new Error(`memory.${k} must be positive`);
	if (s.rewriteTokens >= s.memoryTokens) throw new Error("memory.rewriteTokens must be below memory.memoryTokens");
	return s;
}
interface Snapshot { session: string; leaf: string | null; model: string; context: Context }
const modelKey = (ctx: ExtensionContext) => `${ctx.model?.provider}/${ctx.model?.id}`;
function tools(pi: ExtensionAPI) {
	const all = new Map(pi.getAllTools().map(t => [t.name, t]));
	return pi.getActiveTools().map(name => {
		const t = all.get(name);
		if (!t) throw new Error(`Missing active tool schema: ${name}`);
		return { name: t.name, description: t.description, parameters: t.parameters };
	});
}

export default function memoryExtension(pi: ExtensionAPI) {
	let snapshot: Snapshot | undefined;
	let busy = false;
	let forceRewrite = false;
	pi.on("session_start", () => { snapshot = undefined; forceRewrite = false; });
	pi.on("session_compact", () => { snapshot = undefined; });
	pi.on("context", (event, ctx) => {
		// Even when disabled, render already-persisted blocks identically.
		const branch = ctx.sessionManager.getBranch();
		const messages = expandMemory(event.messages, branch);
		if (settings(ctx.cwd).enabled) snapshot = {
			session: ctx.sessionManager.getSessionId(), leaf: ctx.sessionManager.getLeafId(), model: modelKey(ctx),
			context: structuredClone({ systemPrompt: ctx.getSystemPrompt(), messages: convertToLlm(messages), tools: tools(pi) }),
		};
		return { messages };
	});

	pi.on("session_before_compact", async (event, ctx) => {
		if (busy) return { cancel: true };
		busy = true;
		try {
			const s = settings(ctx.cwd);
			if (!s.enabled) return;
			if (!ctx.model) throw new Error("No active memory model");
			const branch = event.branchEntries;
			const leaf = ctx.sessionManager.getLeafId();
			const session = ctx.sessionManager.getSessionId(), model = modelKey(ctx);
			const visible = visibleEntries(branch);
			const choices = tailChoices(visible);
			let prior = previousBlocks(branch);
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
				context = { systemPrompt: ctx.getSystemPrompt(), tools: tools(pi), messages: convertToLlm(expandMemory(buildSessionContext(branch).messages, branch)) };
			}
			const selfAuthored = context.messages.every((m: any) => m.role !== "assistant" || (m.provider === ctx.model!.provider && m.model === ctx.model!.id));
			context.messages.push({ role: "user", content: instruction(prior, sourceEntries(visible), rewrite, rewrite ? s.rewriteTokens : s.blockTokens, event.customInstructions, { choices, target: s.keepRecentTokens }, selfAuthored), timestamp: Date.now() });
			const stream = (ctx.modelRegistry as any).streamSimple;
			if (typeof stream !== "function") throw new Error("Memory requires Pi's modelRegistry.streamSimple (update Pi)");
			const started = Date.now();
			const response = await stream.call(ctx.modelRegistry, ctx.model, context, {
				signal: event.signal, sessionId: ctx.sessionManager.getSessionId(),
				reasoning: pi.getThinkingLevel() === "off" ? undefined : pi.getThinkingLevel(),
				maxTokens: Math.min(s.maxOutputTokens, ctx.model.maxTokens || s.maxOutputTokens),
			}).result();
			if (event.signal.aborted) throw new Error("Memory cancelled: request aborted");
			const current = ctx.sessionManager.getBranch();
			const originalLeaf = current.findIndex(e => e.id === leaf);
			// Extension bookkeeping (e.g. board cursors) advances the leaf without changing context.
			if (ctx.sessionManager.getSessionId() !== session || modelKey(ctx) !== model || originalLeaf < 0
				|| current.slice(originalLeaf + 1).some(e => e.type !== "custom"))
				throw new Error("Memory cancelled: session or conversation changed");
			if (response.stopReason !== "stop" || response.content.some((b: any) => b.type === "toolCall"))
				throw new Error(`Memory generation did not finish cleanly: ${response.errorMessage ?? response.stopReason}`);
			const text = response.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
			const selection = checkpointJson(text);
			const chosen = choices.find(c => c.id === selection.firstKeptEntryId);
			if (!chosen) throw new Error("Invalid tail start: choose a listed, tool-safe entry ID");
			if (typeof selection.tailReason !== "string" || !selection.tailReason.trim()) throw new Error("Missing tail selection reason");
			const kept = visible[chosen.index], folding = sourceEntries(visible.slice(0, chosen.index));
			if (!folding.length && !rewrite) throw new Error("Chosen tail leaves nothing to fold; context unchanged");
			prior = [...prior, ...visible.slice(0, chosen.index).flatMap(e => e.type === "branch_summary"
				? [{ id: `legacy-${e.id}`, timestamp: Date.parse(e.timestamp), covers: [], observations: [], reflections: [], legacy: e.summary }] : [])];
			const allowed = new Set(folding.map(e => e.id));
			// Prior evidence remains addressable, but never across an unrelated branch.
			const branchIds = new Set(sourceEntries(branch).map(e => e.id));
			for (const c of claims(prior)) for (const id of c.sources) if (branchIds.has(id)) allowed.add(id);
			const block = parseBlock(text, allowed, prior, rewrite, folding.map(e => e.id));
			if (rewrite && roughTokens(renderMemory([block])) >= s.memoryTokens) throw new Error("Rewrite exceeds memory budget; old context retained");
			// Imported summaries cannot be safely dropped without original provenance.
			const blocks = [...(rewrite ? prior.filter(b => b.legacy !== undefined) : prior), block];
			return { compaction: {
				summary: renderMemory(blocks), firstKeptEntryId: kept.id, tokensBefore: event.preparation.tokensBefore,
				usage: response.usage,
				details: { kind: KIND, blocks, operation: rewrite ? "rewrite" : "append", prefixMode, register: "diary-v1", selfAuthored,
					tail: { mode: "model-contiguous", firstKeptEntryId: kept.id, estimatedTokens: chosen.tokens, targetTokens: s.keepRecentTokens, reason: selection.tailReason },
					model: modelKey(ctx), ms: Date.now() - started, usage: response.usage },
			} };
		} catch (error) {
			// Never fall through to native summarization after an invalid/failed checkpoint.
			ctx.ui.notify(`Memory not compacted: ${error instanceof Error ? error.message : error}`, "warning");
			return { cancel: true };
		} finally { busy = false; forceRewrite = false; }
	});

	pi.registerCommand("memory", {
		description: "Append-only memory: status | fold [focus] | rewrite [focus]",
		handler: async (args, ctx) => {
			const [command = "status", ...focus] = args.trim().split(/\s+/).filter(Boolean);
			if (command === "fold" || command === "rewrite") {
				await ctx.waitForIdle();
				if (!settings(ctx.cwd).enabled) { ctx.ui.notify("Memory is disabled in settings", "warning"); return; }
				forceRewrite = command === "rewrite";
				ctx.compact({ customInstructions: focus.join(" ") || undefined,
					onComplete: () => { forceRewrite = false; }, onError: () => { forceRewrite = false; } });
				return;
			}
			const memory = memoryOf(ctx.sessionManager.getBranch()), blocks = memory?.blocks ?? [];
			ctx.ui.notify(`${blocks.length} memory blocks, ~${roughTokens(renderMemory(blocks))} tokens.${memory?.tail ? ` Last chosen tail: ~${memory.tail.estimatedTokens} tokens from ${memory.tail.firstKeptEntryId}. ${memory.tail.reason}` : ""} /memory fold | rewrite [focus]`, "info");
		},
	});
}
