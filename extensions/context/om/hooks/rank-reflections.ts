import type { ClassifierQuestion } from "@earendil-works/pi-ai";
import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import { pickClassifier } from "../../../../lib/decide.ts";
import { debugLog } from "../debug-log.js";
import type { Observation, Reflection } from "../session-ledger/types.js";

type Classifiers = Pick<ModelRegistry, "getAvailableOfType" | "classify">;
const TIMEOUT_MS = 4_000;

/** Only called for render overflow; the ledger and chronological display never change. */
export async function rankReflections(registry: Classifiers, reflections: Reflection[], observations: Observation[], parentSignal?: AbortSignal): Promise<string[]> {
	const newestFirst = reflections.map((r) => r.id).reverse();
	const started = Date.now();
	const controller = new AbortController();
	const signal = parentSignal ? AbortSignal.any([parentSignal, controller.signal]) : controller.signal;
	const timer = setTimeout(() => controller.abort(new Error("Jev reflection ranking timed out")), TIMEOUT_MS);
	let onAbort: () => void;
	const aborted = new Promise<never>((_, reject) => {
		onAbort = () => reject(signal.reason);
		if (signal.aborted) onAbort();
		else signal.addEventListener("abort", onAbort, { once: true });
	});
	try {
		return await Promise.race([aborted, (async () => {
			const available = await registry.getAvailableOfType("classifier", undefined, { signal });
			signal.throwIfAborted();
			const model = pickClassifier(available.filter((m) => m.provider === "typesafe" || m.provider === "openrouter"));
			if (!model) throw new Error("No Jev credential available (TypeSafe or OpenRouter)");
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
			const result = await registry.classify(model, {
				state: {
					reflections: reflections.map(({ id, content }) => ({ id, content })),
					recentObservations: observations.slice(-8).map(({ timestamp, content }) => ({ timestamp, content })),
				},
				questions,
			}, { signal });
			signal.throwIfAborted();
			if (result.stopReason !== "stop") throw new Error(result.errorMessage ?? result.stopReason);
			const ranked = reflections.map((r, i) => {
				const preserve = result.answers[`preserve_${i}`];
				const relevance = result.answers[`relevance_${i}`];
				if (preserve?.type !== "bool" || !Number.isFinite(preserve.probability) || relevance?.type !== "score" || !Number.isFinite(relevance.score)) {
					throw new Error("Invalid Jev reflection ranking answer");
				}
				return { id: r.id, i, preserve: Number(preserve.probability >= 0.5), relevance: relevance.score };
			});
			ranked.sort((a, b) => b.preserve - a.preserve || b.relevance - a.relevance || b.i - a.i);
			debugLog("reflection_rank.ranked", { provider: model.provider, model: result.model, count: ranked.length, elapsedMs: Date.now() - started, usage: result.usage });
			return ranked.map((r) => r.id);
		})()]);
	} catch (error) {
		debugLog("reflection_rank.fallback", { reason: error instanceof Error ? error.message : String(error), elapsedMs: Date.now() - started });
		return newestFirst;
	} finally {
		clearTimeout(timer);
		signal.removeEventListener("abort", onAbort!);
	}
}
