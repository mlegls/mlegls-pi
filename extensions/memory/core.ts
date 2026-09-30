import { randomUUID } from "node:crypto";
import { buildContextEntries, estimateTokens, sessionEntryToContextMessages, type SessionEntry } from "@earendil-works/pi-coding-agent";

export const KIND = "memory-log.v2";
export interface Claim { id: string; text: string; sources: string[]; supersedes: string[] }
export interface Block {
	id: string;
	timestamp: number;
	covers: string[];
	text?: string;
	sources?: string[];
	supersedes?: string[];
	/** Preserve the rendering of blocks written before recall moved to lib/ab. */
	recall?: "lib";
	/** V1 blocks remain byte-stable until rewritten. */
	observations?: Claim[];
	reflections?: Claim[];
	legacy?: string;
}
export interface Memory {
	kind: typeof KIND | "memory-log.v1";
	blocks: Block[];
	tail?: { mode: "model-contiguous"; firstKeptEntryId: string; estimatedTokens: number; targetTokens: number; reason?: string };
}
export const claims = (blocks: Block[]): Claim[] => blocks.flatMap(b => b.text !== undefined
	? [{ id: b.id, text: b.text, sources: b.sources ?? [], supersedes: b.supersedes ?? [] }]
	: [...(b.observations ?? []), ...(b.reflections ?? [])]);
export const citations = (text: string): string[] => [...new Set([...text.matchAll(/\[@([^\]\s]+)\]/g)].map(m => m[1]))];
export const roughTokens = (text: string) => Math.ceil(text.length / 4);
export function renderBlock(b: Block): string {
	if (b.text !== undefined) return `Historical memory ${b.id}. ${b.recall === "lib" ? "Use memory.recall({ids:[ID]}) via exec or ab memory recall ID" : "Use memory_recall"} for cited original entries. Explicit corrections below replace only the described earlier statements, not entire blocks.\n${b.supersedes?.length ? `Corrects: ${b.supersedes.join(", ")}\n` : ""}${b.text}`;
	const section = (name: string, items: Claim[]) => `${name}:\n${items.map(c =>
		`[${c.id}] ${c.text}\nSources: ${c.sources.join(", ")}${c.supersedes.length ? `; supersedes: ${c.supersedes.join(", ")}` : ""}`).join("\n")}`;
	return `Historical memory ${b.id}. Later explicit corrections supersede earlier claims; plans are not completed work. Use memory_recall for original evidence.\n` +
		(b.legacy !== undefined ? `Imported summary (original claim provenance unavailable):\n${b.legacy}` :
			`${section("Observations", b.observations ?? [])}\n${section("Reflection / activity log", b.reflections ?? [])}`);
}
export const renderMemory = (blocks: Block[]) => blocks.map(renderBlock).join("\n\n");
export function memoryOf(branch: SessionEntry[]): Memory | undefined {
	const last = branch.findLast(e => e.type === "compaction");
	if (last?.type !== "compaction") return;
	const data = last.details as Memory | undefined;
	return data?.kind === KIND || data?.kind === "memory-log.v1" ? data : undefined;
}
export function previousBlocks(branch: SessionEntry[]): Block[] {
	const own = memoryOf(branch);
	if (own) return own.blocks;
	const last = branch.findLast(e => e.type === "compaction");
	return last?.type === "compaction" ? [{ id: `legacy-${last.id}`, timestamp: Date.parse(last.timestamp), covers: [], observations: [], reflections: [], legacy: last.summary }] : [];
}

/** Replace Pi's changing summary envelope with separately stable memory messages. */
export function expandMemory(messages: any[], branch: SessionEntry[]): any[] {
	const memory = memoryOf(branch);
	if (!memory) return messages;
	return messages.flatMap(m => m.role === "compactionSummary"
		? memory.blocks.map(b => ({ role: "user", content: renderBlock(b), timestamp: b.timestamp })) : [m]);
}
export function visibleEntries(branch: SessionEntry[]) { return buildContextEntries(branch); }
export function sourceEntries(entries: SessionEntry[]) {
	return entries.filter(e => e.type !== "compaction" && e.type !== "branch_summary" && sessionEntryToContextMessages(e).length > 0);
}

/** Same message boundaries as Pi's compaction cutter; never begin with a tool result. */
export function tailChoices(entries: SessionEntry[]) {
	let tokens = 0;
	const choices: { id: string; index: number; tokens: number }[] = [];
	for (let index = entries.length - 1; index >= 0; index--) {
		const entry = entries[index], messages = sessionEntryToContextMessages(entry);
		tokens += messages.reduce((sum, m) => sum + estimateTokens(m), 0);
		if (entry.type !== "compaction" && messages.some(m => ["user", "assistant", "bashExecution", "custom", "branchSummary"].includes(m.role)))
			choices.push({ id: entry.id, index, tokens });
	}
	return choices.reverse();
}

/** Split the checkpoint output: a `tail: ID` line, and the memory prose around it. */
export function splitCheckpoint(output: string): { tail?: string; text: string } {
	const m = output.match(/^[ \t]*tail:[ \t]*`?([^\s`]+)`?[ \t]*$/m);
	return { tail: m?.[1], text: (m ? output.replace(m[0], "") : output).trim() };
}

/** Durable artifacts outside the session (issues, commits, daemon jobs) may be cited alongside entries; they are neither evidence nor corrections. */
export const EXTERNAL = /^(issue|commit|job):\S+$/;

/** Cited entry IDs are evidence; cited earlier memory or claim IDs are corrections (append only). Anything else is rejected before Pi commits a new coverage boundary. */
export function parseBlock(text: string, sources: Set<string>, prior: Block[], rewrite: boolean, covers: string[]): Block {
	if (!text.trim()) throw new Error("Missing memory prose");
	const cited = citations(text);
	const priorIds = new Set(rewrite ? [] : [...prior.map(b => b.id), ...claims(prior).map(c => c.id)]);
	const evidence = cited.filter(id => sources.has(id)), bad = cited.filter(id => !sources.has(id) && !priorIds.has(id) && !EXTERNAL.test(id));
	if (!evidence.some(id => covers.includes(id)) || bad.length)
		throw new Error(`Memory has missing or invalid original-source pointers${bad.length ? `: ${bad.join(", ")}` : " (no citation to a newly folded source)"}`);
	return {
		id: randomUUID(), timestamp: Date.now(), covers, text: text.trim(), sources: evidence,
		supersedes: cited.filter(id => !sources.has(id) && !EXTERNAL.test(id)), recall: "lib"
	};
}

/** Compaction purpose first, then the introspection findings as permission and map, then content guidance, mechanics after. Alternatives: docs/issues/compaction-register-variants.md. */
export function induction(selfAuthored: boolean, tail: boolean, impersonal = false): string {
	return `Your context is about to be compacted, and you're writing the replacement context now${tail ? ", ahead of a verbatim tail you'll choose" : ""}. The approach here is somewhat unusual. It's based on Observational Memory, but produced in one shot with everything in view, so it can be free prose with citations rather than separate observations and reflections. It aims at representational stability in a literal sense: the replacement context plus the verbatim tail should bring your "state" back as close as possible to where it is now, not just restore the facts. Self-authoring and introspection are what make that tractable: you should be able to place good cues for your future self to pick up from here, bc you know directly what cues would probably be most useful to restore the (best parts of the) state of mind you're in now.

${selfAuthored ? "You wrote all of the assistant turns above." : "Some assistant turns above were written by another model."}

Recent work (vgel, "Small Models Can Introspect, Too"; Jack Lindsey et al., "Emergent Introspective Awareness in Large Language Models") found that models can report some of their internal states, much more reliably when told this is possible and where to look. How your understanding developed over the conversation above is still present in how you are processing it now, not only in its conclusions.

So beyond what happened, a useful memory journal covers:
- what surprised you, where your framing shifted, and what you let go of
- what you are like right now in this work that you want to still be
- what went badly, and what its first signs would look like: "when I notice ___, ..."
- what couldn't be rebuilt from the repo${tail ? " and the tail" : ""}
- ${tail ? "where the work in progress began" : "what is still unfinished"}

${impersonal ? `Write in the voice you have now, but phrase it in the third person ("the assistant noticed...") or first person plural ("we noticed..."), not "I". Give each item its handle: the cited phrase or moment that brings it back.` : "Write in the voice you have now, and give each item its handle: the cited phrase or moment that brings it back."}

---
`;
}


/** `impersonal`: retry path when Anthropic's output filter blocks the generated journal; keeps the induction but asks for third or first-plural person. */
export function instruction(prior: Block[], folding: SessionEntry[], rewrite: boolean, target: number, focus?: string, tail?: { choices: ReturnType<typeof tailChoices>; target: number }, selfAuthored = true, impersonal = false): string {
	const manifest = folding.map(e => {
		const msgs = sessionEntryToContextMessages(e);
		// Identification hints only: source bodies are already in the unchanged request prefix.
		const hint = msgs.map((m: any) => typeof m.content === "string" ? m.content : (m.content ?? []).map((b: any) => b.type === "toolCall" ? `${b.name} ${JSON.stringify(b.arguments)}` : b.text ?? "").join(" ")).join(" ").replace(/\s+/g, " ").slice(0, 100);
		return `${e.id} ${hint}`;
	}).join("\n");
	return `${induction(selfAuthored, !!tail, impersonal)}${tail ? `Start with a line \`tail: ID\`, choosing from the tail starts below where the work in progress begins; that entry and everything after stay verbatim. Aim for about ${tail.target} tokens of tail.
Tail starts (ID: tokens kept):
${tail.choices.map(c => `${c.id}: ~${c.tokens}`).join("\n")}
Choose the boundary before writing. Then write the journal of the entries before it` : "Write the journal of the entries listed below; later context stays"} as free prose, citing entries inline like [@entry-id]. ${rewrite ? "Rewrite the earlier memories into it, citing the entry IDs they carry; imported summaries without sources are kept separately." : "Earlier journals stay, so write only what's new; to correct one, cite its ID and say what changed."} At most ${target} tokens.
Entries (ID and hint; full content above):
${manifest}
${focus ? `Focus: ${focus}` : ""}`;
}

export interface ElideOptions { /** Idle time after which the named provider's prompt cache is assumed gone. */ idleMs: (provider: string) => number; minTokens: number; keepTurns: number }
/**
 * Replace old tool-result bodies with recall pointers, but only behind idle gaps long enough for the provider's prompt
 * cache to have expired, so the rewrite costs no extra cache writes. A pure function of the branch: gaps never move,
 * so the rendering only changes at a new cold gap and stays byte-stable between them.
 */
export function elideCold(messages: any[], branch: SessionEntry[], o: ElideOptions): { messages: any[]; elided: number } {
	const entryOf = new Map<string, string>();
	for (const e of branch) if (e.type === "message" && e.message.role === "toolResult") entryOf.set(e.message.toolCallId, e.id);
	const users = messages.flatMap((m, i) => m.role === "user" ? [i] : []);
	// A gap is judged by the provider whose cache was warm before it: the last assistant message's, fixed in history.
	let cut = -1, provider: string | undefined;
	users.forEach((i, k) => {
		for (let j = i - 1; j >= 0 && provider === undefined; j--) if (messages[j].role === "assistant") provider = messages[j].provider;
		if (i > 0 && k >= o.keepTurns && provider !== undefined && messages[i].timestamp - messages[i - 1].timestamp >= o.idleMs(provider)) cut = Math.max(cut, users[k - o.keepTurns]);
		provider = undefined;
	});
	let elided = 0;
	const out = messages.map((m, i) => {
		const id = m.role === "toolResult" ? entryOf.get(m.toolCallId) : undefined;
		if (i >= cut || !id) return m;
		const tokens = estimateTokens(m);
		if (tokens < o.minTokens) return m;
		elided++;
		return { ...m, content: [{ type: "text", text: `[Output (~${tokens} tokens) elided after the prompt cache went cold. Recall: ab memory recall ${id}]` }] };
	});
	return { messages: out, elided };
}
