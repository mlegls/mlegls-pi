// journal: the agent's own memory, written by the agent through a real tool. It can call
// `journal` any time; at compaction it is asked to (over the native replay of its context, tools
// declared), and its calls become records of schema `journal` in the records store, with `cites`
// edges to session entries and `corrects` edges to earlier entries. In context, compacted history
// is rendered back as those same tool calls (with the thinking that produced them, when there is
// any), not as a summary message: notes the agent took through a tool it has. That is also a shape
// Anthropic's reasoning-extraction filter passes where long prose in a reasoning-like place trips
// it (anima-research/context-manager, src/tool-prose-hoist.ts).
//
// A record is in the rendered memory when it was written by a checkpoint listed in a journal
// compaction's details on this branch, or by a tool call whose message is no longer in context.
//
// Settings: memory.schemas.journal { enabled, budget, keepRecentTokens, maxOutputTokens,
// compaction: { afterTokens, ratio } }.
import { Type, type AssistantMessage, type Message, type ThinkingContent, type ToolCall } from "@earendil-works/pi-ai";
import {
	buildContextEntries, buildSessionContext, convertToLlm, defineTool, estimateTokens, getAgentDir, sessionEntryToContextMessages,
	type ExtensionAPI, type ExtensionContext, type SessionBeforeCompactEvent, type SessionEntry,
} from "@earendil-works/pi-coding-agent";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { anchor, chainRecords, entryOf, entryRef, visible, type Anchored, type BranchSession } from "../../lib/records/branch.ts";
import { render, type Renderer } from "../../lib/records/render.ts";
import { db, stamp, write, type Tag } from "../../lib/records/store.ts";
import { isActive, type CompactionMechanism, type CompactionView, type Prepared } from "./compaction.ts";

export const SCHEMA = "journal";
const NAME = "journal";
const REGISTER = "journal-v2"; // v1 had no introspection induction
const BLOCKED = /reverse engineering|duplicating model outputs/i;

interface Settings { enabled: boolean; budget: number; keepRecentTokens: number; maxOutputTokens: number; compaction: { afterTokens?: number; ratio?: number } }

function settings(cwd: string): Settings {
	let j: Record<string, any> = {};
	for (const path of [join(getAgentDir(), "settings.json"), join(cwd, ".pi", "settings.json")]) {
		if (!existsSync(path)) continue;
		try { j = { ...j, ...JSON.parse(readFileSync(path, "utf8")).memory?.schemas?.journal }; } catch {}
	}
	return { enabled: true, budget: 12_000, keepRecentTokens: 4_000, maxOutputTokens: 12_000, ...j, compaction: { ratio: 0.5, ...j.compaction } };
}

// ---------- records ----------

interface EntryArgs { content: string; cites?: string[]; corrects?: string[] }

function writeEntry(sm: BranchSession, args: EntryArgs, meta: { via: "tool" | "checkpoint"; toolCallId: string; response: string; extra?: Tag[] }, valid: Set<string>) {
	const a = anchor(sm);
	const session = sm.getSessionId();
	const cites = (args.cites ?? []).filter((id) => valid.has(id));
	return write({
		schema: SCHEMA,
		body: args.content,
		tags: [...a.tags, { key: "journal.via", value: meta.via }, { key: "journal.toolCallId", value: meta.toolCallId }, { key: "journal.response", value: meta.response }, ...(meta.extra ?? [])],
		edges: [...a.edges, ...cites.map((id) => ({ rel: "cites", dst: entryRef(session, id) })), ...(args.corrects ?? []).map((id) => ({ rel: "corrects", dst: id }))],
	});
}

const tag = (r: Anchored, key: string) => r.record.tags.find((t) => t.key === key)?.value;

// ---------- the tool ----------

const journalTool = defineTool({
	name: NAME,
	label: "Journal",
	description:
		"Write a journal entry: something to carry forward when earlier context is compacted, such as a decision and its reason, what was tried and how it went, " +
		"what surprised you, or what's unfinished. Entries outlive compaction: compacted history is replaced by them.",
	parameters: Type.Object({
		content: Type.String({ description: "The entry, in your own words." }),
		cites: Type.Optional(Type.Array(Type.String(), { description: "Session entry ids it draws on (listed at compaction)." })),
		corrects: Type.Optional(Type.Array(Type.String(), { description: "Ids of earlier journal entries this amends." })),
		keepFrom: Type.Optional(Type.String({ description: "Only at compaction: the entry where the verbatim tail starts." })),
	}),
	async execute(toolCallId, params, _signal, _onUpdate, ctx) {
		const sm = ctx.sessionManager as unknown as BranchSession;
		const valid = new Set((sm.getBranch() as { id: string }[]).map((e) => e.id));
		const rec = writeEntry(sm, params, { via: "tool", toolCallId, response: toolCallId }, valid);
		const dropped = (params.cites ?? []).filter((id) => !valid.has(id));
		const notes = [dropped.length ? `unknown entry ids dropped from cites: ${dropped.join(", ")}` : "", params.keepFrom ? "keepFrom only applies at compaction" : ""].filter(Boolean);
		return { content: [{ type: "text" as const, text: `recorded ${rec.id}${notes.length ? ` (${notes.join("; ")})` : ""}` }], details: { id: rec.id } };
	},
});

// ---------- rendering ----------

export interface JournalView extends CompactionView {
	/** Tool call ids still in context; their journal records render as themselves. */
	kept?: Set<string>;
}

const toolCallIds = (messages: readonly unknown[]) => {
	const out = new Set<string>();
	for (const m of messages as { role?: string; content?: unknown }[])
		if (m.role === "assistant" && Array.isArray(m.content)) for (const b of m.content as { type: string; id?: string }[]) if (b.type === "toolCall" && b.id) out.add(b.id);
	return out;
};

function listed(branch: SessionEntry[], prepared: unknown): Set<string> {
	const out = new Set<string>((prepared as { records?: string[] } | undefined)?.records ?? []);
	for (const e of branch) if (e.type === "compaction" && (e.details as { kind?: string } | undefined)?.kind === SCHEMA)
		for (const id of (e.details as { records?: string[] }).records ?? []) out.add(id);
	return out;
}

const zero = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };

export const journalRenderer: Renderer<JournalView, { records: Anchored[]; branch: SessionEntry[] }> = {
	name: NAME,
	role: "memory",
	query(view) {
		const branch = view.branch as SessionEntry[];
		const ids = listed(branch, view.prepared);
		let kept = view.kept;
		if (!kept) {
			const at = branch.findIndex((e) => e.id === view.firstKeptEntryId);
			kept = toolCallIds(at < 0 ? [] : branch.slice(at).flatMap((e) => sessionEntryToContextMessages(e)));
		}
		const records = visible(view.session, chainRecords(view.session, SCHEMA), branch)
			.filter((r) => tag(r, "journal.via") === "checkpoint" ? ids.has(r.record.id) : !kept!.has(tag(r, "journal.toolCallId") as string));
		return { records, branch };
	},
	cut({ records, branch }, _budget, view) {
		if (!records.length) return undefined;
		// tool-written entries: their original assistant message, for its model and thinking
		const origin = new Map<string, AssistantMessage>();
		for (const e of branch) if (e.type === "message" && e.message.role === "assistant")
			for (const b of e.message.content) if (b.type === "toolCall" && b.name === NAME) origin.set(b.id, e.message);
		const groups = new Map<string, Anchored[]>();
		for (const r of records) {
			const g = tag(r, "journal.response") as string;
			groups.set(g, [...(groups.get(g) ?? []), r]);
		}
		const messages: unknown[] = [];
		messages.push({ role: "user", content: [{ type: "text", text: "Earlier context was compacted into the journal entries below." }], timestamp: Date.parse(records[0]!.record.ts) });
		for (const rs of groups.values()) {
			const r0 = rs[0]!;
			const from = origin.get(tag(r0, "journal.toolCallId") as string);
			const model = (from ?? tag(r0, "journal.model") ?? {}) as { api?: string; provider?: string; model?: string };
			const carrier = (from ? from.content.filter((b) => b.type === "thinking") : (tag(r0, "journal.carrier") ?? [])) as ThinkingContent[];
			const calls: ToolCall[] = rs.map((r) => {
				const cites = r.edges.filter((e) => e.rel === "cites").map((e) => entryOf(e.dst));
				const corrects = r.edges.filter((e) => e.rel === "corrects").map((e) => e.dst);
				return { type: "toolCall", id: tag(r, "journal.toolCallId") as string, name: NAME,
					arguments: { content: r.record.body, ...(cites.length ? { cites } : {}), ...(corrects.length ? { corrects } : {}) } };
			});
			const ts = Date.parse(r0.record.ts);
			messages.push({ role: "assistant", content: [...carrier, ...calls], api: model.api ?? "unknown", provider: model.provider ?? "unknown", model: model.model ?? "unknown",
				usage: zero, stopReason: "toolUse", timestamp: ts });
			for (const r of rs) messages.push({ role: "toolResult", toolCallId: tag(r, "journal.toolCallId"), toolName: NAME,
				content: [{ type: "text", text: `recorded ${r.record.id}` }], isError: false, timestamp: ts });
		}
		const text = records.map((r) => `Journal ${r.record.id}:\n${r.record.body}`).join("\n\n");
		return { text, messages, details: view.prepared ? { kind: SCHEMA, ...(view.prepared as object) } : undefined };
	},
};

/** Replace a journal compaction's summary message with the rendered entries. */
export function expand(messages: any[], sm: BranchSession, branch: SessionEntry[]): any[] {
	const latest = branch.findLast((e) => e.type === "compaction");
	if (latest?.type !== "compaction" || (latest.details as { kind?: string } | undefined)?.kind !== SCHEMA) return messages;
	const i = messages.findIndex((m) => m.role === "compactionSummary");
	if (i < 0) return messages;
	const s = render(journalRenderer, { session: sm, branch, firstKeptEntryId: latest.firstKeptEntryId, kept: toolCallIds(messages) }, Infinity);
	if (!s?.messages) return messages;
	return [...messages.slice(0, i), ...s.messages, ...messages.slice(i + 1)];
}

// ---------- the checkpoint ----------

/** Same message boundaries as pi's compaction cutter; never begin with a tool result. */
function tailChoices(entries: SessionEntry[]) {
	let tokens = 0;
	const choices: { id: string; index: number; tokens: number }[] = [];
	for (let index = entries.length - 1; index >= 0; index--) {
		const entry = entries[index]!, messages = sessionEntryToContextMessages(entry);
		tokens += messages.reduce((sum, m) => sum + estimateTokens(m), 0);
		if (entry.type !== "compaction" && messages.some((m) => ["user", "assistant", "bashExecution", "custom", "branchSummary"].includes(m.role)))
			choices.push({ id: entry.id, index, tokens });
	}
	return choices.reverse();
}

const sources = (entries: SessionEntry[]) => entries.filter((e) => e.type !== "compaction" && e.type !== "branch_summary" && sessionEntryToContextMessages(e).length > 0);

function hint(e: SessionEntry): string {
	return sessionEntryToContextMessages(e).map((m: any) => typeof m.content === "string" ? m.content
		: (m.content ?? []).map((b: any) => b.type === "toolCall" ? `${b.name} ${JSON.stringify(b.arguments)}` : b.text ?? "").join(" "))
		.join(" ").replace(/\s+/g, " ").slice(0, 100);
}

function instruction(folding: SessionEntry[], choices: { id: string; tokens: number }[], target: number, budget: number, selfAuthored: boolean, focus?: string): string {
	return `Your context is about to be compacted, and you're writing the replacement context now, ahead of a verbatim tail you'll choose. The approach here is somewhat unusual. It's based on Observational Memory, but produced in one shot with everything in view, so it can be free prose in journal entries with citations rather than separate observations and reflections. It aims at representational stability in a literal sense: the journal plus the verbatim tail should bring your "state" back as close as possible to where it is now, not just restore the facts. Self-authoring and introspection are what make that tractable: you should be able to place good cues for your future self to pick up from here, bc you know directly what cues would probably be most useful to restore the (best parts of the) state of mind you're in now.

${selfAuthored ? "You wrote all of the assistant turns above." : "Some assistant turns above were written by another model."}

Recent work (vgel, "Small Models Can Introspect, Too"; Jack Lindsey et al., "Emergent Introspective Awareness in Large Language Models") found that models can report some of their internal states, much more reliably when told this is possible and where to look. How your understanding developed over the conversation above is still present in how you are processing it now, not only in its conclusions.

So beyond what happened, a useful memory journal covers:
- what surprised you, where your framing shifted, and what you let go of
- what you are like right now in this work that you want to still be
- what went badly, and what its first signs would look like: "when I notice ___, ..."
- what couldn't be rebuilt from the repo and the tail
- where the work in progress began
- which standing rules you are carrying and where each came from: cite the user's turn or the document for a rule; one you inferred yourself says so, and a later user turn outranks it

Write in the voice you have now, and give each item its handle: the cited phrase or moment that brings it back.

---
Write it by calling \`journal\` (one entry or several), citing entry ids in \`cites\`, and give one of the calls \`keepFrom\`: the tail start where the work in progress begins (aim for about ${target} tokens of tail). Earlier journal entries stay, so write only what's new; to amend one, pass its id in \`corrects\`. At most ${budget} tokens in all.

Tail starts (id: tokens kept):
${choices.map((c) => `${c.id}: ~${c.tokens}`).join("\n")}

Entries (id and hint; full content above):
${folding.map((e) => `${e.id} ${hint(e)}`).join("\n")}
${focus ? `\nFocus: ${focus}` : ""}`;
}

interface Snapshot { session: string; leaf: string | null; model: string; messages: any[] }
const modelKey = (ctx: ExtensionContext) => `${ctx.model?.provider}/${ctx.model?.id}`;

// The request exactly as last sent (captured below), so a checkpoint replays it (cache hit) instead of rebuilding.
let snapshot: Snapshot | undefined;

/** The context about to be compacted, as messages to append a checkpoint instruction to: the captured request plus
 * what followed it when that still matches the branch, else rebuilt. Shared by every mechanism that checkpoints. */
export function replay(event: SessionBeforeCompactEvent, ctx: ExtensionContext, tools: () => unknown[]): { messages: any[]; prefixMode: "captured" | "reconstructed" } {
	const sm = ctx.sessionManager;
	const branch = event.branchEntries as SessionEntry[];
	const at = snapshot?.leaf ? branch.findIndex((e) => e.id === snapshot!.leaf) : -1;
	const additions = at >= 0 ? branch.slice(at + 1) : [];
	if (snapshot && snapshot.session === sm.getSessionId() && snapshot.model === modelKey(ctx) && at >= 0 && !additions.some((e) => e.type === "compaction" || e.type === "branch_summary"))
		return { messages: [...snapshot.messages, ...additions.flatMap((e) => sessionEntryToContextMessages(e))], prefixMode: "captured" };
	return { messages: [{ role: "system", content: ctx.getSystemPrompt(), toolsAdded: tools() }, ...expand(buildSessionContext(branch).messages, sm as unknown as BranchSession, branch)], prefixMode: "reconstructed" };
}

/** The active tools as declared to the model, for a rebuilt checkpoint request. */
export const activeTools = (pi: ExtensionAPI) => {
	const all = new Map(pi.getAllTools().map((t) => [t.name, t]));
	return pi.getActiveTools().flatMap((name) => {
		const t = all.get(name);
		return t ? [{ name: t.name, description: t.description, parameters: t.parameters }] : [];
	});
};

export default function journal(pi: ExtensionAPI): CompactionMechanism {
	let busy = false;
	let triggering = false;

	pi.registerTool(journalTool);

	pi.on("session_start", () => { snapshot = undefined; });
	pi.on("session_compact", () => { snapshot = undefined; });
	pi.on("context", (event, ctx) => {
		const out = expand(event.messages, ctx.sessionManager as unknown as BranchSession, ctx.sessionManager.getBranch() as SessionEntry[]);
		return out === event.messages ? undefined : { messages: out };
	});
	pi.on("context_with_system", (event, ctx) => {
		snapshot = { session: ctx.sessionManager.getSessionId(), leaf: ctx.sessionManager.getLeafId(), model: modelKey(ctx), messages: structuredClone(event.messages) };
	});

	const tools = () => activeTools(pi);

	pi.on("agent_settled", (_event, ctx) => {
		const s = settings(ctx.cwd);
		if (!s.enabled || triggering || busy || !isActive(NAME, ctx)) return;
		const u = ctx.getContextUsage();
		if (!u?.tokens) return;
		const threshold = s.compaction.afterTokens ?? Math.floor(u.contextWindow * (s.compaction.ratio ?? 0.5));
		if (u.tokens < threshold) return;
		triggering = true;
		ctx.compact({ onComplete: () => { triggering = false; }, onError: () => { triggering = false; } });
	});

	async function prepare(event: SessionBeforeCompactEvent, ctx: ExtensionContext): Promise<Prepared> {
		const s = settings(ctx.cwd);
		if (!ctx.model) throw new Error("no active model");
		const sm = ctx.sessionManager;
		const branch = event.branchEntries as SessionEntry[];
		const session = sm.getSessionId(), leaf = sm.getLeafId(), model = modelKey(ctx);
		const inContext = buildContextEntries(branch);
		const choices = tailChoices(inContext);
		if (!choices.some((c) => sources(inContext.slice(0, c.index)).length)) throw new Error("nothing to fold outside a continuous tail");

		const { messages, prefixMode } = replay(event, ctx, tools);
		const selfAuthored = messages.every((m) => m.role !== "assistant" || (m.provider === ctx.model!.provider && m.model === ctx.model!.id));
		const folding = sources(inContext.slice(0, choices.at(-1)!.index));
		messages.push({ role: "user", content: [{ type: "text", text: instruction(folding, choices, s.keepRecentTokens, s.budget, selfAuthored, event.customInstructions) }], timestamp: Date.now() });

		const started = Date.now();
		const thinking = pi.getThinkingLevel();
		let response: AssistantMessage;
		try {
			response = await ctx.modelRegistry.streamSimple(ctx.model, { messages: convertToLlm(messages) as Message[] }, {
				sessionId: session, reasoning: thinking === "off" ? undefined : thinking, maxTokens: Math.min(s.maxOutputTokens, ctx.model.maxTokens || s.maxOutputTokens), signal: event.signal,
			} as any).result();
		} catch (error) {
			response = { stopReason: "error", errorMessage: String(error), content: [] } as unknown as AssistantMessage;
		}
		try {
			const dir = (sm as { getSessionDir?: () => string }).getSessionDir?.() ?? tmpdir();
			appendFileSync(join(dir, "journal-attempts.jsonl"), JSON.stringify({ session, leaf, model, register: REGISTER, prefixMode, timestamp: new Date().toISOString(),
				ms: Date.now() - started, stopReason: response.stopReason, error: response.errorMessage, usage: response.usage }) + "\n");
		} catch {}
		if (response.stopReason === "error" || response.stopReason === "aborted")
			throw new Error(BLOCKED.test(response.errorMessage ?? "") ? "checkpoint blocked by the provider's filter" : `checkpoint failed: ${response.errorMessage ?? response.stopReason}`);

		const calls = response.content.filter((b): b is ToolCall => b.type === "toolCall" && b.name === NAME);
		const text = response.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
		const entries: { id: string; args: EntryArgs & { keepFrom?: string } }[] = calls.length
			? calls.map((c) => ({ id: c.id, args: c.arguments as unknown as EntryArgs & { keepFrom?: string } })).filter((c) => typeof c.args.content === "string" && c.args.content.trim())
			: text ? [{ id: `journal_${stamp().id.replace(/[^a-zA-Z0-9_-]/g, "_")}`, args: { content: text } }] : [];
		if (!entries.length) throw new Error("checkpoint wrote no journal entry");

		const keepFrom = entries.find((e) => e.args.keepFrom)?.args.keepFrom;
		const chosen = choices.find((c) => c.id === keepFrom) ?? choices.find((c) => c.id === event.preparation.firstKeptEntryId) ?? choices.at(-1)!;
		if (!sources(inContext.slice(0, chosen.index)).length) throw new Error("chosen tail leaves nothing to fold");

		// the conversation must not have moved on meanwhile (extension bookkeeping entries are fine)
		const current = sm.getBranch() as SessionEntry[];
		const was = current.findIndex((e) => e.id === leaf);
		if (sm.getSessionId() !== session || was < 0 || current.slice(was + 1).some((e) => e.type !== "custom")) throw new Error("session changed during the checkpoint");

		const valid = new Set(branch.map((e) => e.id));
		const responseId = stamp().id;
		const carrier = response.content.filter((b) => b.type === "thinking");
		const ids: string[] = [];
		db().transaction(() => {
			entries.forEach((e, i) => ids.push(writeEntry(sm as unknown as BranchSession, e.args, {
				via: "checkpoint", toolCallId: e.id, response: responseId,
				extra: [{ key: "journal.model", value: { api: response.api, provider: response.provider, model: response.model } },
					...(i === 0 && carrier.length ? [{ key: "journal.carrier", value: carrier }] : [])],
			}, valid).id));
		})();
		return { firstKeptEntryId: chosen.id, records: ids, register: REGISTER, prefixMode, selfAuthored, keepFrom: keepFrom ?? null, model, ms: Date.now() - started, usage: response.usage };
	}

	return {
		renderer: journalRenderer,
		budget: () => Infinity,
		enabled: (ctx) => settings(ctx.cwd).enabled,
		prepare,
		begin() {
			if (busy) return false;
			busy = true;
			return true;
		},
		end() { busy = false; },
	};
}
