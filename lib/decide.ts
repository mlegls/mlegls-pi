// decide: typed Jev evaluation; thresholds and fallback selection belong to the caller.
//
//   const answers = await decide(state, {
//     route: { type: "choice", instructions: "Who owns this?", criteria: { billing: "Payments", technical: "Bugs" } },
//   });
//   const pending = ask(state, questions); // caller may publish needs-input; no suspension here
//   await decide(state, questions, { backend: "logprobs", model: "gpt-4.1-nano", apiKey });
//   bun lib/decide.ts request.json [jev|logprobs|ask]   # request: {state, questions}
//
// Jev: CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN, or JEV_API_KEY (TypeSafe direct).
// Logprobs: OpenAI-compatible chat completions; OPENAI_API_KEY, DECIDE_MODEL, DECIDE_URL.
// p is the winning option's probability, NOT Jev's distribution-derived confidence.
// Score keeps its weighted score as well as the modal level in choice. Logprobs distributions
// are conditional on the listed labels, not calibrated Jev probabilities. No automatic retry.

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type State = string | Json[] | { [key: string]: Json };
export type Question = { instructions: State } & (
	| { type: "noul"; criteria?: { true?: string; false?: string } }
	| { type: "choice"; criteria: Record<string, string | null> }
	| { type: "score"; criteria: string[] }
);
export type Questions = Record<string, Question>;
export interface Decision {
	choice: string;
	p: number;
	dist: Record<string, number>;
	score?: number;
}
export type Decisions<Q extends Questions = Questions> = { [K in keyof Q]: Decision };
export interface Ask<Q extends Questions = Questions> {
	kind: "needs-input";
	state: State;
	questions: Q;
}
export interface Options {
	backend?: "jev" | "logprobs" | "ask";
	apiKey?: string;
	accountId?: string;
	url?: string;
	model?: string;
	signal?: AbortSignal;
}
export type JevAnswer =
	| { type: "noul"; noul: number }
	| { type: "choice"; choice: string; confidence: number; probabilities: Record<string, number> }
	| { type: "score"; score: number; confidence: number; legend: Record<string, string>; probabilities: Record<string, number> };
export interface JevResponse {
	model: string;
	answers: Record<string, JevAnswer>;
	usage: { input_tokens: number; output_tokens: number };
}

export function ask<Q extends Questions>(state: State, questions: Q): Ask<Q> {
	return { kind: "needs-input", state, questions };
}

function decision(dist: Record<string, number>, choice?: string): Decision {
	const entries = Object.entries(dist);
	if (!entries.length || entries.some(([, p]) => !Number.isFinite(p) || p < 0 || p > 1)
		|| Math.abs(entries.reduce((n, [, p]) => n + p, 0) - 1) > 0.01) {
		throw new Error("Invalid probability distribution");
	}
	choice ??= entries.reduce((a, b) => b[1] > a[1] ? b : a)[0];
	if (!Object.hasOwn(dist, choice)) throw new Error("Choice missing from distribution");
	return { choice, p: dist[choice]!, dist };
}

function criteria(q: Question): Record<string, string | null> {
	if (q.type === "noul") return { true: q.criteria?.true ?? "Yes", false: q.criteria?.false ?? "No" };
	if (q.type === "score") return Object.fromEntries(q.criteria.map((v, i) => [String(i), v]));
	return q.criteria;
}

async function post(url: string, apiKey: string | undefined, body: unknown, signal?: AbortSignal): Promise<any> {
	if (!apiKey) throw new Error("Missing API key (JEV_API_KEY, CLOUDFLARE_API_TOKEN, or OPENAI_API_KEY)");
	const response = await fetch(url, {
		method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
		body: JSON.stringify(body), signal,
	});
	if (!response.ok) throw new Error(`Decision API: HTTP ${response.status}`);
	return response.json();
}

export function decide<Q extends Questions>(state: State, questions: Q, options: Options & { backend: "ask" }): Promise<Ask<Q>>;
export function decide<Q extends Questions>(state: State, questions: Q, options?: Options & { backend?: "jev" | "logprobs" }): Promise<Decisions<Q>>;
export function decide<Q extends Questions>(state: State, questions: Q, options: Options): Promise<Decisions<Q> | Ask<Q>>;
export async function decide<Q extends Questions>(state: State, questions: Q, options: Options = {}): Promise<Decisions<Q> | Ask<Q>> {
	if (options.backend === "ask") return ask(state, questions);
	if (options.backend === "logprobs") {
		const pairs = await Promise.all(Object.entries(questions).map(async ([id, q]) => {
			const choices = Object.entries(criteria(q));
			if (choices.length < 2 || choices.length > 20) throw new Error("Logprobs requires 2–20 options per question");
			const labels = choices.map((_, i) => String.fromCharCode(65 + i));
			const result = await post(options.url ?? process.env.DECIDE_URL ?? "https://api.openai.com/v1/chat/completions",
				options.apiKey ?? process.env.OPENAI_API_KEY, {
					model: options.model ?? process.env.DECIDE_MODEL ?? "gpt-4.1-nano",
					messages: [
						{ role: "system", content: "Evaluate the supplied state against the question. Return exactly one option letter, nothing else." },
						{ role: "user", content: JSON.stringify({ state, instructions: q.instructions,
							options: Object.fromEntries(choices.map(([choice, description], i) => [labels[i], { choice, description }])) }) },
					], max_tokens: 1, temperature: 0, logprobs: true, top_logprobs: 20,
				}, options.signal);
			const top: { token: string; logprob: number }[] | undefined = result.choices?.[0]?.logprobs?.content?.[0]?.top_logprobs;
			if (!top) throw new Error("Model did not return token logprobs");
			const weights = labels.map(label => top.filter(t => t.token.trim() === label)
				.reduce((sum, t) => sum + Math.exp(t.logprob), 0));
			if (weights.some(p => !Number.isFinite(p) || p <= 0)) throw new Error("Incomplete option logprobs; use Jev or ask");
			const total = weights.reduce((a, b) => a + b, 0);
			const answer = decision(Object.fromEntries(choices.map(([key], i) => [key, weights[i]! / total])));
			if (q.type === "score") answer.score = Object.entries(answer.dist).reduce((sum, [k, p]) => sum + Number(k) * p, 0);
			return [id, answer];
		}));
		return Object.fromEntries(pairs) as Decisions<Q>;
	}
	const accountId = options.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID;
	const cloudflare = !!accountId;
	const input = { state, questions };
	const raw = await post(options.url ?? (cloudflare
		? `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId!)}/ai/run`
		: "https://api.typesafe.ai/v1/systemone"),
		options.apiKey ?? (cloudflare ? process.env.CLOUDFLARE_API_TOKEN : process.env.JEV_API_KEY),
		cloudflare ? { model: options.model ?? "typesafe/jev", input } : { ...input, model: options.model ?? "jev-latest" }, options.signal);
	if (raw.success === false) throw new Error("Cloudflare evaluation failed");
	const result: JevResponse = raw.result ?? raw;
	return Object.fromEntries(Object.entries(questions).map(([id, q]) => {
		const a = result.answers?.[id];
		if (!a || a.type !== q.type) throw new Error(`Missing or mismatched Jev answer: ${id}`);
		const dist = a.type === "noul" ? { true: a.noul, false: 1 - a.noul } : a.probabilities;
		const keys = Object.keys(criteria(q));
		if (!dist || Object.keys(dist).length !== keys.length || keys.some(k => !Object.hasOwn(dist, k))) {
			throw new Error(`Mismatched Jev options: ${id}`);
		}
		const answer = decision(dist, a.type === "choice" ? a.choice : undefined);
		if (a.type === "score") answer.score = a.score;
		return [id, answer];
	})) as Decisions<Q>;
}

if (import.meta.main) {
	const [path, backend = "jev"] = process.argv.slice(2);
	if (!path || !["jev", "logprobs", "ask"].includes(backend)) {
		console.error("usage: bun lib/decide.ts request.json [jev|logprobs|ask]");
		process.exit(2);
	}
	const { state, questions } = await Bun.file(path).json();
	console.log(JSON.stringify(await decide(state, questions, { backend: backend as Options["backend"] }), null, 2));
}
