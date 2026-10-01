// decide: typed Jev judgments through pi's classifier models (ModelRuntime.classify), for code
// running outside a pi session such as the tracker CLI. Inside pi, use ctx.modelRegistry.classify
// or codemode's models.classify directly. Thresholds and fallbacks belong to the caller.
//
//   const { route } = await decide(state, {
//     route: { type: "choice", instructions: "Who owns this?", criteria: { billing: "Payments", technical: "Bugs" } },
//   });
//   route.choice, route.p, route.dist
//
// `noul` is a bool question whose dist is { true, false }. p is the chosen option's probability.
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import type { ClassifierModel, ClassifierQuestion, ClassifierApi } from "@earendil-works/pi-ai";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type State = { [key: string]: Json };
export type Question = { instructions: string } & (
	| { type: "noul"; criteria?: { true?: string; false?: string } }
	| { type: "choice"; criteria: Record<string, string> }
	| { type: "score"; criteria: string[] }
);
export type Questions = Record<string, Question>;
export interface Decision { choice: string; p: number; dist: Record<string, number>; score?: number }
export type Decisions<Q extends Questions = Questions> = { [K in keyof Q]: Decision };
export interface Options { signal?: AbortSignal; model?: { provider: string; id: string } }

/** Preferred classifier: TypeSafe direct, then any provider's Jev with credentials. */
const PREFERRED = [{ provider: "typesafe", id: "jev-latest" }, { provider: "openrouter", id: "~typesafe/jev-latest" }, { provider: "cloudflare-workers-ai", id: "typesafe/jev" }];

let runtime: Promise<ModelRuntime> | undefined;

async function classifier(options: Options): Promise<{ rt: ModelRuntime; model: ClassifierModel<ClassifierApi> }> {
	const rt = await (runtime ??= ModelRuntime.create());
	const available = await rt.getAvailableOfType("classifier");
	for (const want of options.model ? [options.model] : PREFERRED) {
		const model = available.find(m => m.provider === want.provider && m.id === want.id);
		if (model) return { rt, model };
	}
	const jev = available.find(m => m.id.includes("jev"));
	if (!jev) throw new Error("decide: no Jev classifier with credentials (TYPESAFE_API_KEY, OpenRouter, or Cloudflare)");
	return { rt, model: jev };
}

function toClassifier(q: Question): ClassifierQuestion {
	if (q.type === "noul") return { type: "bool", instructions: q.instructions, criteria: { true: q.criteria?.true ?? "Yes", false: q.criteria?.false ?? "No" } };
	return q;
}

function decision(dist: Record<string, number>, choice?: string): Decision {
	const sum = Object.values(dist).reduce((n, p) => n + p, 0);
	if (!Number.isFinite(sum) || sum <= 0) throw new Error("Invalid probability distribution");
	dist = Object.fromEntries(Object.entries(dist).map(([k, p]) => [k, p / sum]));
	choice ??= Object.entries(dist).reduce((a, b) => b[1] > a[1] ? b : a)[0];
	return { choice, p: dist[choice] ?? 0, dist };
}

export async function decide<Q extends Questions>(state: State, questions: Q, options: Options = {}): Promise<Decisions<Q>> {
	const { rt, model } = await classifier(options);
	const result = await rt.classify(model, {
		state,
		questions: Object.fromEntries(Object.entries(questions).map(([id, q]) => [id, toClassifier(q)])),
	}, { signal: options.signal });
	if (result.stopReason !== "stop") throw new Error("decide: " + (result.errorMessage ?? result.stopReason));
	return Object.fromEntries(Object.entries(questions).map(([id, q]) => {
		const a = result.answers[id];
		if (!a) throw new Error("decide: missing answer " + id);
		if (a.type === "bool") return [id, decision({ true: a.probability, false: 1 - a.probability })];
		if (a.type === "choice") return [id, decision(a.probabilities, a.choice)];
		const level = String(Math.round(a.score));
		return [id, { choice: level, p: a.confidence, dist: { [level]: 1 }, score: a.score }];
	})) as Decisions<Q>;
}
