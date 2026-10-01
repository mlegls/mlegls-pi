// Elide old tool outputs once the prompt cache is already cold. When a user message arrives after an idle gap
// longer than the cache lifetime of the provider that served the last reply before it, tool results of at least
// minTokens from before the last keepTurns user turns are replaced with a pointer (`recall <id>`). Tool
// calls and result messages stay in place; only bodies change. Computed purely from the branch (timestamps and
// providers): gaps never move, so the rendering changes only at a new cold gap and stays byte-stable between them,
// after a reload or on another branch. The rewrite lands when the provider would re-prefill anyway.
//
// Each elision is also a record of schema `elided` in the records store: id a hash of the entry id (so the pointer
// stays a pure function of the branch), a `source` edge to the entry, tags for tool, tokens and what was called.
// The body stays in the session file; `recall` (./recall.ts) resolves these ids too, so old outputs come back
// through the same tool as memories, and are findable across sessions by tool or command.
//
// Lifetimes err long (under-eliding): Anthropic, Bedrock, xAI 330s (5-minute TTL refreshed on hit); OpenAI, Codex,
// Azure 3660s ("5-10 minutes of inactivity, up to one hour"); anything unpublished or best-effort (DeepSeek "hours to
// days", Z.ai, Gemini implicit, routers) a day. PI_CACHE_RETENTION=long (1h Anthropic, 24h OpenAI) moves them.
//
// Settings: memory.elide { enabled, idleSeconds: number | { [provider]: seconds, default }, minTokens, keepTurns }.
import { estimateTokens, getAgentDir, type ExtensionAPI, type SessionEntry } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { anchor, entryRef, type BranchSession } from "../../lib/records/branch.ts";
import { db, write } from "../../lib/records/store.ts";

export interface ElideOptions { /** Idle time after which the named provider's prompt cache is assumed gone. */ idleMs: (provider: string) => number; minTokens: number; keepTurns: number }

/** Never elided: the journal's own notes are memory, not output. */
const KEEP = new Set(["journal"]);

/** The recall id of an elided output: 12 hex, like OM memory ids, derived from the entry so rendering stays pure. */
export const elidedId = (entry: string) => createHash("sha1").update("elided:" + entry).digest("hex").slice(0, 12);

export interface Elision { id: string; entry: string; tool: string; tokens: number; call?: unknown }

export function elideCold(messages: any[], branch: SessionEntry[], o: ElideOptions): { messages: any[]; elided: number; elisions: Elision[] } {
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
	const elisions: Elision[] = [];
	const callArgs = new Map<string, unknown>();
	for (const m of messages) if (m.role === "assistant") for (const c of m.content ?? []) if (c.type === "toolCall") callArgs.set(c.id, c.arguments);
	const out = messages.map((m, i) => {
		const id = m.role === "toolResult" && !KEEP.has(m.toolName) ? entryOf.get(m.toolCallId) : undefined;
		if (i >= cut || !id) return m;
		const tokens = estimateTokens(m);
		if (tokens < o.minTokens) return m;
		const e = { id: elidedId(id), entry: id, tool: m.toolName, tokens, call: callArgs.get(m.toolCallId) };
		elisions.push(e);
		return { ...m, content: [{ type: "text", text: "[Output (~" + tokens + " tokens) elided after the prompt cache went cold. recall " + e.id + "]" }] };
	});
	return { messages: out, elided: elisions.length, elisions };
}

function cacheSeconds(long: boolean): Record<string, number> {
	const anthropic = long ? 3630 : 330, openai = long ? 86700 : 3660;
	return { default: 86400, anthropic, "amazon-bedrock": anthropic, xai: 330, openai, "openai-codex": openai, "azure-openai-responses": openai };
}

export function settings(cwd: string) {
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

/** Write a record per elision not yet in the store; idempotent across requests, reloads and processes. */
function persist(sm: BranchSession, elisions: Elision[], written: Set<string>) {
	const fresh = elisions.filter((e) => !written.has(e.id));
	if (!fresh.length) return;
	const d = db();
	const have = new Set((d.query("SELECT id FROM records WHERE schema = 'elided' AND id IN (" + fresh.map(() => "?").join(",") + ")").all(...fresh.map((e) => e.id)) as { id: string }[]).map((r) => r.id));
	const a = anchor(sm);
	for (const e of fresh) {
		written.add(e.id);
		if (have.has(e.id)) continue;
		const call = e.call === undefined ? "" : JSON.stringify(e.call).slice(0, 400);
		write({ id: e.id, schema: "elided", body: e.tool + (call ? " " + call : ""),
			tags: [...a.tags, { key: "tool", value: e.tool }, { key: "tokens", value: e.tokens }],
			edges: [...a.edges, { rel: "source", dst: entryRef(sm.getSessionId(), e.entry) }] }, d);
	}
}

/** The elided output behind a recall id, from the branch; undefined when the id is no elision on it. */
export function recallElided(branch: SessionEntry[], id: string): { entry: SessionEntry; content: any[] } | undefined {
	for (const e of branch) if (e.type === "message" && e.message.role === "toolResult" && elidedId(e.id) === id) return { entry: e, content: e.message.content as any[] };
}

export default function (pi: ExtensionAPI) {
	let count = 0;
	const written = new Set<string>();
	pi.on("session_start", () => { count = 0; });
	pi.on("context", (event, ctx) => {
		const s = settings(ctx.cwd);
		if (!s.enabled) return;
		const r = elideCold(event.messages, ctx.sessionManager.getBranch() as SessionEntry[], {
			idleMs: (p) => (s.idleSeconds[p] ?? s.idleSeconds.default) * 1000, minTokens: s.minTokens, keepTurns: s.keepTurns,
		});
		if (r.elided > count) ctx.ui.notify("Cache was cold: elided " + (r.elided - count) + " old tool outputs (" + r.elided + " total)", "info");
		count = r.elided;
		try { persist(ctx.sessionManager as unknown as BranchSession, r.elisions, written); }
		catch (err) { console.warn("[elide] records not written: " + (err as Error).message); }
		return r.elided ? { messages: r.messages } : undefined;
	});
}
