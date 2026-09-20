// Classify a ticket with optional map/autoread output in one Jev call.
//   await classify({ ticket, context }, threshold);
//   bun lib/classify.ts ticket.md threshold [context-file] >> decisions.jsonl
// p is the weaker winning probability, not a calibrated joint probability.
// Keep JSON output with the ticket/run for comparison against outcomes.
import { ask, decide, type Questions } from "./decide.ts";

export const questions = {
	route: {
		type: "choice",
		instructions: "Choose the next work shape from the ticket and supplied context, not its historical completion status. Apply the criteria in order: unclear done, known diff, single piece, independent known pieces, decomposition needing investigation.",
		criteria: {
			plan: "It is not clear what done looks like; clarify the goal or acceptance criterion first.",
			"implement-here": "Done is clear and the change can already be described as a concrete diff; implement directly.",
			do: "Done is clear; one cohesive piece of work, but the concrete diff is not yet known.",
			compile: "Several largely independent pieces whose implementation is already known; they could be written now but for length.",
			orchestrate: "Several pieces whose implementation or decomposition still requires looking into them; dispatch each piece recursively.",
		},
	},
	executor: {
		type: "choice",
		instructions: "Choose the executor for the next work, not the ticket's historical author. Prefer a specialist when the work itself is research, behavioral verification, or subtractive refactoring; otherwise select the general executor by closure, difficulty, and ambiguity.",
		criteria: {
			fill: "Closed, thoroughly specified compiled unit: stub, context, and precedent are in hand; implementation is direct and obvious.",
			technical: "Clear acceptance criterion (metric, stub, mock) but fulfilment is hard and requires strong reasoning: complex systems, UI, difficult or novel algorithms.",
			"auto-routine": "Straightforward work that still needs discovery; neither a closed compiled unit nor unresolved design.",
			auto: "Ambiguous work with unresolved design or decomposition, or a child whose leaf type cannot yet be predicted.",
			research: "Find sources and compress evidence faithfully for an upstream decision; research is the deliverable, not implementation.",
			verify: "Verify implemented behavior as a user would, especially after a complex implementation; exercise the product and report what holds or fails.",
			prune: "Subtractive refactoring or radical replacement: remove ruled code, regenerate against surviving interfaces, remove dangling callers; less or similar code is added than removed.",
		},
	},
} satisfies Questions;

export type Route = keyof typeof questions.route.criteria;
export type Executor = keyof typeof questions.executor.criteria;
export interface DispatchInput { ticket: string; context?: string }
export interface DispatchDecision {
	route: Route;
	executor: Executor;
	p: number;
	dist: { route: Record<string, number>; executor: Record<string, number> };
}

export async function classify(input: DispatchInput, threshold: number) {
	if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
		throw new Error("threshold must be between 0 and 1");
	}
	const state = { ticket: input.ticket, ...(input.context === undefined ? {} : { context: input.context }) };
	const { route, executor } = await decide(state, questions);
	const result: DispatchDecision = {
		route: route.choice as Route, executor: executor.choice as Executor,
		p: Math.min(route.p, executor.p), dist: { route: route.dist, executor: executor.dist },
	};
	return result.p < threshold ? { ...ask(state, questions), decision: result } : result;
}

// Sum cache-read tokens across the worker's calls, not current context occupancy.
// Budget is caller policy; the audit does not establish an optimal numeric fence.
export function cacheReadFence(tokensSoFar: number, budget: number): "continue" | "respawn" {
	if (!Number.isFinite(tokensSoFar) || tokensSoFar < 0 || !Number.isFinite(budget) || budget <= 0) {
		throw new Error("cache-read tokens must be nonnegative and budget must be positive (finite)");
	}
	return tokensSoFar >= budget ? "respawn" : "continue";
}

if (import.meta.main) {
	const [ticket, threshold, context] = process.argv.slice(2);
	if (!ticket || !threshold || process.argv.length > 5) {
		console.error("usage: bun lib/classify.ts ticket.md threshold [context-file]");
		process.exit(2);
	}
	console.log(JSON.stringify(await classify({
		ticket: await Bun.file(ticket).text(),
		...(context ? { context: await Bun.file(context).text() } : {}),
	}, Number(threshold))));
}
