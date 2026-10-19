import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createAssistantMessageEventStream, type AssistantMessage } from "@earendil-works/pi-ai";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { reconcilerCompletion } from "./reconciler-notices.ts";

const PROVIDER = "bb-local";
const MODEL = "worker-completion";
const RESTORE = "bb-notice-model";
const REPLY = "Worker completion noted.";
type Selection = { provider: string; id: string; thinking: ReturnType<ExtensionAPI["getThinkingLevel"]> };

/** Drop only pairs certified by our local assistant, not notices guessed from titles
 * or ownership that may have disappeared since the run finished. Works on replay too. */
export function withoutCompletions(messages: AgentMessage[]): AgentMessage[] {
	const drop = new Set<number>();
	for (let i = 1; i < messages.length; i++) {
		const reply = messages[i];
		const input = messages[i - 1];
		if (reply.role !== "assistant" || reply.provider !== PROVIDER || reply.model !== MODEL || input.role !== "user") continue;
		const text = typeof input.content === "string" ? input.content : input.content.filter(c => c.type === "text").map(c => c.text).join("\n");
		if (!text.startsWith("[bb system]\n\n@thread:")) continue;
		drop.add(i - 1);
		drop.add(i);
	}
	return messages.filter((_, i) => !drop.has(i));
}

/** BB 0.46.1 never settles an input hook's { action: "handled" } (bb#3792).
 * Until fixed, run a normal local turn: no network, no tools, zero usage.
 * Once fixed, replace this stand-in with handled; retain replay filtering. */
export function localCompletions(pi: ExtensionAPI) {
	pi.registerProvider(PROVIDER, {
		api: "bb-local-completion",
		apiKey: "local",
		baseUrl: "local://bb",
		models: [{
			id: MODEL, name: "BB worker completion (local)", reasoning: false,
			input: ["text"], contextWindow: Number.MAX_SAFE_INTEGER, maxTokens: 32,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		}],
		streamSimple(model, _context, options) {
			const stream = createAssistantMessageEventStream();
			const aborted = options?.signal?.aborted;
			const message: AssistantMessage = {
				role: "assistant", api: model.api, provider: model.provider, model: model.id,
				content: aborted ? [] : [{ type: "text", text: REPLY }],
				stopReason: aborted ? "aborted" : "stop",
				...(aborted ? { errorMessage: "Aborted" } : {}),
				timestamp: Date.now(),
				usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
			};
			if (aborted) stream.push({ type: "error", reason: "aborted", error: message });
			else {
				stream.push({ type: "start", partial: message });
				stream.push({ type: "text_start", contentIndex: 0, partial: message });
				stream.push({ type: "text_delta", contentIndex: 0, delta: REPLY, partial: message });
				stream.push({ type: "text_end", contentIndex: 0, content: REPLY, partial: message });
				stream.push({ type: "done", reason: "stop", message });
			}
			stream.end();
			return stream;
		},
	});

	let previous: Selection | undefined;
	pi.on("input", async (event, ctx) => {
		// A notice queued into a running turn must not swap that turn's model: let it through.
		if (event.streamingBehavior || !ctx.model || !await reconcilerCompletion(event.text, ctx.cwd)) return;
		const model = ctx.modelRegistry.find(PROVIDER, MODEL);
		if (!model) return;
		previous = { provider: ctx.model.provider, id: ctx.model.id, thinking: pi.getThinkingLevel() };
		// Recovery if the process exits before agent_end restores the selection.
		pi.appendEntry(RESTORE, previous);
		await pi.setModel(model);
	});
	pi.on("agent_end", async (_event, ctx) => {
		if (!previous) return;
		const model = ctx.modelRegistry.find(previous.provider, previous.id);
		if (model && await pi.setModel(model)) {
			pi.setThinkingLevel(previous.thinking);
			previous = undefined;
		}
	});
	pi.on("session_start", async (_event, ctx) => {
		if (ctx.model?.provider !== PROVIDER) return;
		const entry = [...ctx.sessionManager.getBranch()].reverse().find(e => e.type === "custom" && e.customType === RESTORE);
		if (entry?.type !== "custom") return;
		const selection = entry.data as Selection;
		const model = ctx.modelRegistry.find(selection.provider, selection.id);
		if (model && await pi.setModel(model)) pi.setThinkingLevel(selection.thinking);
	});
	pi.on("context", event => ({ messages: withoutCompletions(event.messages) }));
	pi.on("cache_warming_decision", (_event, ctx) => {
		if (ctx.model?.provider === PROVIDER) return { action: "stop" };
	});
}
