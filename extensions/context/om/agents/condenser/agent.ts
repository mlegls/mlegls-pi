import { agentLoop, type AgentContext, type AgentLoopConfig, type AgentTool } from "@earendil-works/pi-agent-core";
import type { Message, Model, ModelThinkingLevel } from "@earendil-works/pi-ai";
import { Type } from "@earendil-works/pi-ai";
import type { Static } from "typebox";
import { debugLog } from "../../debug-log.js";
import { hashId } from "../../ids.js";
import { AGENT_LOOP_MAX_TOKENS, boundedMaxTokens } from "../../model-budget.js";
import { truncateRecordContent } from "../../serialize.js";
import { estimateStringTokens } from "../../tokens.js";
import { reflectionToSummaryLine, type Reflection } from "../../session-ledger/index.js";
import { logAgentStreamError } from "../stream-errors.js";
import { resolveWorkerStreamSimple, type StreamableModelRegistry, type WorkerStreamSimple } from "../worker-stream.js";
import { CONDENSER_SYSTEM } from "./prompts.js";

/** Rendered footprint of the reflection pool, as the compaction summary carries it. */
export function reflectionPoolTokens(reflections: readonly Reflection[]): number {
	return reflections.reduce((sum, reflection) => sum + estimateStringTokens(reflectionToSummaryLine(reflection)), 0);
}

interface RunCondenserArgs {
	model: Model<any>;
	apiKey?: string;
	headers?: Record<string, string>;
	env?: Record<string, string>;
	reflections: Reflection[];
	targetTokens: number;
	signal?: AbortSignal;
	agentLoop?: typeof agentLoop;
	maxTurns?: number;
	maxOutputTokens?: number;
	thinkingLevel?: ModelThinkingLevel;
	modelRegistry?: StreamableModelRegistry;
	streamSimple?: WorkerStreamSimple;
}

export type CondenserResult = { reflections: Reflection[]; droppedIds: string[] };

const MergeSchema = Type.Object({
	merges: Type.Array(Type.Object({
		ids: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
		content: Type.String({ minLength: 1 }),
	}), { minItems: 1 }),
});
const DropSchema = Type.Object({
	ids: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
	reason: Type.Optional(Type.String()),
});

/**
 * Merge and drop reflections toward targetTokens. Merged reflections inherit the union of the
 * replaced ones' supportingObservationIds; replaced and dropped ids come back as droppedIds, which
 * the caller records as tombstones.
 */
export async function runCondenser(args: RunCondenserArgs): Promise<CondenserResult | undefined> {
	const { model, apiKey, headers, env, reflections, targetTokens, signal } = args;
	if (reflections.length === 0) return undefined;
	const poolTokens = reflectionPoolTokens(reflections);
	if (poolTokens <= targetTokens) return undefined;

	const byId = new Map(reflections.map((reflection) => [reflection.id, reflection]));
	const consumed = new Set<string>();
	const added = new Map<string, Reflection>();
	const dropped: string[] = [];
	let merges = 0, drops = 0, rejected = 0;
	const take = (ids: readonly string[]): Reflection[] | undefined => {
		const unique = [...new Set(ids)];
		if (unique.some((id) => !byId.has(id) || consumed.has(id))) return undefined;
		return unique.map((id) => byId.get(id)!);
	};
	const remaining = () => reflectionPoolTokens(reflections.filter((r) => !consumed.has(r.id))) + reflectionPoolTokens([...added.values()]);
	const status = () => `Pool now ~${remaining().toLocaleString()} tokens; target ~${targetTokens.toLocaleString()}.`;

	const merge: AgentTool<typeof MergeSchema> = {
		name: "merge_reflections",
		label: "Merge reflections",
		description: "Replace current reflections (by id) with one shorter reflection preserving their durable meaning.",
		parameters: MergeSchema,
		execute: async (_id, params: Static<typeof MergeSchema>) => {
			let ok = 0, bad = 0;
			for (const m of params.merges) {
				const sources = take(m.ids);
				const content = truncateRecordContent(m.content.trim());
				if (!sources || !content || /\r|\n/.test(content)) { bad++; continue; }
				const id = hashId(content);
				const supportingObservationIds = [...new Set(sources.flatMap((s) => s.supportingObservationIds))];
				for (const s of sources) {
					consumed.add(s.id);
					if (s.id !== id) dropped.push(s.id);
				}
				if (!byId.has(id)) added.set(id, { id, content, supportingObservationIds, tokenCount: estimateStringTokens(content) });
				ok++;
			}
			merges += ok;
			rejected += bad;
			return { content: [{ type: "text", text: `Merged ${ok}; rejected ${bad} (unknown or already-used ids, or multi-line content). ${status()}` }], details: { ok, bad } };
		},
	};
	const drop: AgentTool<typeof DropSchema> = {
		name: "drop_reflections",
		label: "Drop reflections",
		description: "Remove current reflections (by id) that are superseded, obsolete, or never durable.",
		parameters: DropSchema,
		execute: async (_id, params: Static<typeof DropSchema>) => {
			let ok = 0, bad = 0;
			for (const id of new Set(params.ids)) {
				if (!take([id])) { bad++; continue; }
				consumed.add(id);
				dropped.push(id);
				ok++;
			}
			drops += ok;
			rejected += bad;
			return { content: [{ type: "text", text: `Dropped ${ok}; rejected ${bad}. ${status()}` }], details: { ok, bad } };
		},
	};

	const userText = `CURRENT REFLECTIONS (oldest first):\n${reflections.map(reflectionToSummaryLine).join("\n")}\n\nReflection pool: ~${poolTokens.toLocaleString()} tokens across ${reflections.length} reflections; target: ~${targetTokens.toLocaleString()} tokens; over by ~${(poolTokens - targetTokens).toLocaleString()}.`;
	const prompts: Message[] = [{ role: "system", content: CONDENSER_SYSTEM, timestamp: Date.now() } as Message, { role: "user", content: [{ type: "text", text: userText }], timestamp: Date.now() }];
	const context: AgentContext = { messages: [], tools: [merge as AgentTool<any>, drop as AgentTool<any>] };
	const reasoning = (model as { reasoning?: unknown }).reasoning;
	const thinkingLevel = args.thinkingLevel ?? "low";
	const effectiveMaxTurns = args.maxTurns && args.maxTurns > 0 ? args.maxTurns : undefined;
	let turnCount = 0;
	const config: AgentLoopConfig = {
		model,
		apiKey,
		headers,
		env,
		maxTokens: boundedMaxTokens(model, args.maxOutputTokens ?? AGENT_LOOP_MAX_TOKENS),
		convertToLlm: (msgs) => msgs as Message[],
		toolExecution: "sequential",
		...(reasoning && thinkingLevel !== "off" ? { reasoning: thinkingLevel } : {}),
		...(effectiveMaxTurns !== undefined ? { shouldStopAfterTurn: () => ++turnCount >= effectiveMaxTurns } : {}),
	};
	const stream = (args.agentLoop ?? agentLoop)(prompts, context, config, signal,
		resolveWorkerStreamSimple(model, args.modelRegistry, args.streamSimple) as any); // pi-ai is duplicated under pi-agent-core; same runtime shape
	for await (const event of stream) logAgentStreamError("condenser", event);
	await stream.result();
	debugLog("condenser.result", { poolTokens, targetTokens, afterTokens: remaining(), merges, drops, rejected, added: added.size, dropped: dropped.length });
	if (dropped.length === 0 && added.size === 0) return undefined;
	return { reflections: [...added.values()], droppedIds: dropped };
}

/**
 * Run condenser passes, each over the previous pass's result, until the pool is at target, a pass
 * changes nothing, or maxPasses. One pass shrinks a large pool only partly (58k → 51k tokens on
 * the evidence session). Returns the net change: reflections to record and ids to tombstone; a
 * reflection added by one pass and replaced by a later one is neither.
 */
export async function condenseToTarget(args: RunCondenserArgs & { maxPasses?: number }): Promise<CondenserResult | undefined> {
	const original = new Set(args.reflections.map((r) => r.id));
	let pool = args.reflections;
	const added = new Map<string, Reflection>();
	const dropped = new Set<string>();
	for (let pass = 0; pass < (args.maxPasses ?? 4); pass++) {
		const result = await runCondenser({ ...args, reflections: pool });
		if (!result) break;
		for (const id of result.droppedIds) {
			if (original.has(id)) dropped.add(id);
			added.delete(id);
		}
		for (const r of result.reflections) if (!original.has(r.id)) added.set(r.id, r);
		const gone = new Set(result.droppedIds);
		pool = [...pool.filter((r) => !gone.has(r.id)), ...result.reflections];
		debugLog("condenser.pass", { pass, poolTokens: reflectionPoolTokens(pool), targetTokens: args.targetTokens });
		if (reflectionPoolTokens(pool) <= args.targetTokens) break;
	}
	if (dropped.size === 0 && added.size === 0) return undefined;
	return { reflections: [...added.values()], droppedIds: [...dropped] };
}
