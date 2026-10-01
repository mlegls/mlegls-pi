// Elide old tool outputs once the prompt cache is already cold. When a user message arrives after an idle gap
// longer than the cache lifetime of the provider that served the last reply before it, tool results of at least
// minTokens from before the last keepTurns user turns are replaced with a pointer (recall_output ENTRY-ID). Tool
// calls and result messages stay in place; only bodies change. Computed purely from the branch (timestamps and
// providers): gaps never move, so the rendering changes only at a new cold gap and stays byte-stable between them,
// after a reload or on another branch. The rewrite lands when the provider would re-prefill anyway.
//
// Lifetimes err long (under-eliding): Anthropic, Bedrock, xAI 330s (5-minute TTL refreshed on hit); OpenAI, Codex,
// Azure 3660s ("5-10 minutes of inactivity, up to one hour"); anything unpublished or best-effort (DeepSeek "hours to
// days", Z.ai, Gemini implicit, routers) a day. PI_CACHE_RETENTION=long (1h Anthropic, 24h OpenAI) moves them.
//
// Settings: memory.elide { enabled, idleSeconds: number | { [provider]: seconds, default }, minTokens, keepTurns }.
import { estimateTokens, getAgentDir, type ExtensionAPI, type SessionEntry } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Type } from "typebox";

export interface ElideOptions { /** Idle time after which the named provider's prompt cache is assumed gone. */ idleMs: (provider: string) => number; minTokens: number; keepTurns: number }

/** Never elided: the journal's own notes are memory, not output. */
const KEEP = new Set(["journal", "recall_output"]);

export function elideCold(messages: any[], branch: SessionEntry[], o: ElideOptions): { messages: any[]; elided: number } {
	const entryOf = new Map<string, string>();
	for (const e of branch) if (e.type === "message" && e.message.role === "toolResult") entryOf.set(e.message.toolCallId, e.id);
	const users = messages.flatMap((m, i) => (m.role === "user" ? [i] : []));
	// A gap is judged by the provider whose cache was warm before it: the last assistant message's, fixed in history.
	let cut = -1;
	users.forEach((i, k) => {
		let provider: string | undefined;
		for (let j = i - 1; j >= 0 && provider === undefined; j--) if (messages[j].role === "assistant") provider = messages[j].provider;
		if (i > 0 && k >= o.keepTurns && provider !== undefined && messages[i].timestamp - messages[i - 1].timestamp >= o.idleMs(provider)) cut = Math.max(cut, users[k - o.keepTurns]);
	});
	let elided = 0;
	const out = messages.map((m, i) => {
		const id = m.role === "toolResult" && !KEEP.has(m.toolName) ? entryOf.get(m.toolCallId) : undefined;
		if (i >= cut || !id) return m;
		const tokens = estimateTokens(m);
		if (tokens < o.minTokens) return m;
		elided++;
		return { ...m, content: [{ type: "text", text: "[Output (~" + tokens + " tokens) elided after the prompt cache went cold. recall_output " + id + "]" }] };
	});
	return { messages: out, elided };
}

function cacheSeconds(long: boolean): Record<string, number> {
	const anthropic = long ? 3630 : 330, openai = long ? 86700 : 3660;
	return { default: 86400, anthropic, "amazon-bedrock": anthropic, xai: 330, openai, "openai-codex": openai, "azure-openai-responses": openai };
}

function settings(cwd: string) {
	let s: Record<string, any> = {};
	for (const path of [join(getAgentDir(), "settings.json"), join(cwd, ".pi", "settings.json")]) {
		if (!existsSync(path)) continue;
		try { s = { ...s, ...JSON.parse(readFileSync(path, "utf8")).memory?.elide }; } catch {}
	}
	const idle = s.idleSeconds;
	return {
		enabled: s.enabled ?? true, minTokens: s.minTokens ?? 500, keepTurns: s.keepTurns ?? 1,
		idleSeconds: (typeof idle === "number" ? { default: idle } : { ...cacheSeconds(process.env.PI_CACHE_RETENTION === "long"), ...idle }) as Record<string, number>,
	};
}

export default function (pi: ExtensionAPI) {
	let count = 0;
	pi.on("session_start", () => { count = 0; });
	pi.on("context", (event, ctx) => {
		const s = settings(ctx.cwd);
		if (!s.enabled) return;
		const r = elideCold(event.messages, ctx.sessionManager.getBranch() as SessionEntry[], {
			idleMs: (p) => (s.idleSeconds[p] ?? s.idleSeconds.default) * 1000, minTokens: s.minTokens, keepTurns: s.keepTurns,
		});
		if (r.elided > count) ctx.ui.notify("Cache was cold: elided " + (r.elided - count) + " old tool outputs (" + r.elided + " total)", "info");
		count = r.elided;
		return r.elided ? { messages: r.messages } : undefined;
	});
	pi.registerTool({
		name: "recall_output",
		label: "recall output",
		description: "Return a tool output that was elided from context after the prompt cache went cold, by the entry id in its pointer.",
		parameters: Type.Object({ id: Type.String({ description: "Entry id from the elision pointer" }) }),
		async execute(_id, params, _signal, _onUpdate, ctx) {
			const e = (ctx.sessionManager.getBranch() as SessionEntry[]).find((x) => x.id === params.id);
			if (!e || e.type !== "message" || e.message.role !== "toolResult") throw new Error("no tool result " + params.id + " on this branch");
			return { content: e.message.content as any, details: undefined };
		},
	});
}
