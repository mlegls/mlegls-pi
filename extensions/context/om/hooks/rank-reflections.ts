import type { ClassifierModel, ClassifierApi, ClassifierQuestion } from "@earendil-works/pi-ai";
import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import { pickClassifier } from "../../../../lib/decide.ts";
import { appendLog, debugLog } from "../debug-log.js";
import type { Observation, Reflection } from "../session-ledger/types.js";

type Classifiers = Pick<ModelRegistry, "getAvailableOfType" | "classify">;
export type RankLog = (event: string, data: Record<string, unknown>) => void;

/** OpenRouter decision models, tried in order. Measured 2026-10-20 on bool and score questions
 * (docs/issues/fall-back-across-decision-models-when-ranking-reflections.md): Jev, then Clef
 * (Clef Flash's scores were barely confident), then Mercury Decide, another family. */
export const RANKERS = [
	{ provider: "openrouter", id: "~typesafe/jev-latest" },
	{ provider: "openrouter", id: "cloudflare/clef" },
	{ provider: "openrouter", id: "inception/mercury-decide" },
];
const DEADLINE_MS = 6_000;
const ATTEMPT_MS = 3_000;

/** On by default: every attempt's model and outcome, so failures in practice are visible. */
const defaultLog: RankLog = (event, data) => {
	appendLog("reflection-rank.ndjson", event, data);
	debugLog(event, data);
};

function untilAborted<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
	let onAbort!: () => void;
	const aborted = new Promise<never>((_, reject) => {
		onAbort = () => reject(signal.reason);
		if (signal.aborted) onAbort();
		else signal.addEventListener("abort", onAbort, { once: true });
	});
	return Promise.race([aborted, work]).finally(() => signal.removeEventListener("abort", onAbort));
}

function questionsFor(reflections: Reflection[]): Record<string, ClassifierQuestion> {
	const questions: Record<string, ClassifierQuestion> = {};
	reflections.forEach((_, i) => {
		questions[`preserve_${i}`] = {
			type: "bool",
			instructions: `Does reflections[${i}] state the session's designated role, a user identity or preference, standing permission, constraint or correction, an open blocker, or a decision still in force? Use recentObservations and the other reflections to distinguish current facts from superseded ones.`,
			criteria: { true: "A preservation-floor fact still in force", false: "Ordinary information or a superseded fact" },
		};
		questions[`relevance_${i}`] = {
			type: "score",
			instructions: `How useful is reflections[${i}] for continuing the session's current work, as shown by recentObservations?`,
			criteria: ["Unrelated to current work", "Useful background for current work", "Directly needed to continue current work"],
		};
	});
	return questions;
}

async function rankWith(registry: Classifiers, model: ClassifierModel<ClassifierApi>, reflections: Reflection[], observations: Observation[], signal: AbortSignal) {
	const result = await registry.classify(model, {
		state: {
			reflections: reflections.map(({ id, content }) => ({ id, content })),
			recentObservations: observations.slice(-8).map(({ timestamp, content }) => ({ timestamp, content })),
		},
		questions: questionsFor(reflections),
	}, { signal });
	signal.throwIfAborted();
	if (result.stopReason !== "stop") throw new Error(result.errorMessage ?? result.stopReason);
	const ranked = reflections.map((r, i) => {
		const preserve = result.answers[`preserve_${i}`];
		const relevance = result.answers[`relevance_${i}`];
		if (preserve?.type !== "bool" || !Number.isFinite(preserve.probability) || relevance?.type !== "score" || !Number.isFinite(relevance.score)) {
			throw new Error("Invalid reflection ranking answer");
		}
		return { id: r.id, i, preserve: Number(preserve.probability >= 0.5), relevance: relevance.score };
	});
	ranked.sort((a, b) => b.preserve - a.preserve || b.relevance - a.relevance || b.i - a.i);
	return { order: ranked.map((r) => r.id), result };
}

/** Only called for render overflow; the ledger and chronological display never change.
 * Tries each of RANKERS within one deadline; newest-first only when all fail. */
export async function rankReflections(registry: Classifiers, reflections: Reflection[], observations: Observation[], parentSignal?: AbortSignal, options: { log?: RankLog } = {}): Promise<string[]> {
	const log = options.log ?? defaultLog;
	const newestFirst = reflections.map((r) => r.id).reverse();
	const started = Date.now();
	const deadline = AbortSignal.any([AbortSignal.timeout(DEADLINE_MS), ...(parentSignal ? [parentSignal] : [])]);
	const elapsedMs = () => Date.now() - started;
	const reason = (error: unknown) => error instanceof Error ? error.message : String(error);
	let available: readonly ClassifierModel<ClassifierApi>[] = [];
	try {
		available = await untilAborted(registry.getAvailableOfType("classifier", "openrouter", { signal: deadline }), deadline);
	} catch (error) {
		log("reflection_rank.fallback", { model: "newest-first", reason: "classifier availability: " + reason(error), elapsedMs: elapsedMs() });
		return newestFirst;
	}
	for (const want of RANKERS) {
		const model = `${want.provider}/${want.id}`;
		if (deadline.aborted) break;
		const candidate = pickClassifier(available, want);
		if (!candidate) {
			log("reflection_rank.attempt_failed", { model, reason: "not available (no OpenRouter credential, or not catalogued)", elapsedMs: elapsedMs() });
			continue;
		}
		const signal = AbortSignal.any([deadline, AbortSignal.timeout(ATTEMPT_MS)]);
		const attemptStarted = Date.now();
		try {
			const { order, result } = await untilAborted(rankWith(registry, candidate, reflections, observations, signal), signal);
			log("reflection_rank.ranked", { model, count: order.length, latencyMs: Date.now() - attemptStarted, elapsedMs: elapsedMs(), cost: result.usage?.cost?.total, usage: result.usage });
			return order;
		} catch (error) {
			log("reflection_rank.attempt_failed", { model, reason: signal.aborted && !deadline.aborted ? "attempt timed out after " + ATTEMPT_MS + " ms" : reason(error), latencyMs: Date.now() - attemptStarted, elapsedMs: elapsedMs() });
		}
	}
	log("reflection_rank.fallback", { model: "newest-first", reason: deadline.aborted ? "deadline or caller abort" : "every model failed", elapsedMs: elapsedMs() });
	return newestFirst;
}
