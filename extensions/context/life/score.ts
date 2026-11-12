// optmem's scorer, for cut "scored" (./tree.ts): one Jev judgment per merge, made once when the
// merge is built (or first seen without one) and recorded, so the cut is a pure function of the
// records and never drifts. The loss is the chance that an agent continuing the chat would need a
// detail the merged line dropped; the cut folds low-loss merges first.
import { pickClassifier } from "../../../lib/decide.ts";

export const LOSS_QUESTION = "<merged> replaces <parts> in a coding agent's memory of a long session (parts and merged are one-line summaries of consecutive messages). Would an agent continuing this session plausibly need a detail that is in <parts> but missing from <merged>: a file path, a value, a name, a decision and its reason, an error, an open question, or what the user asked for?";

export async function lossOf(registry: any, parts: string[], merged: string, signal: AbortSignal, want?: { provider: string; id: string }): Promise<number> {
	const model = pickClassifier(await registry.getAvailableOfType("classifier"), want);
	if (!model) throw new Error(want ? `classifier ${want.provider}/${want.id} is not available` : "no Jev classifier with credentials");
	const r = await registry.classify(model, {
		state: { parts, merged },
		questions: { loss: { type: "bool", instructions: LOSS_QUESTION, criteria: { true: "A needed detail is lost", false: "Nothing needed is lost" } } },
	}, { signal });
	if (r.stopReason !== "stop") throw new Error("scoring: " + (r.errorMessage ?? r.stopReason));
	const a = r.answers.loss;
	if (a?.type !== "bool") throw new Error("scoring: no answer");
	return a.probability;
}
