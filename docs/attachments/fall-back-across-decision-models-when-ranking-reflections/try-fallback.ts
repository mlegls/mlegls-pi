// Live fallback run: OpenRouter only (OPENROUTER_API_KEY), the first ranker forced to fail.
// Submits only the synthetic fixture; prints which model ranked, its latency and cost. Never prints credentials.
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { RANKERS, rankReflections } from "../../../extensions/context/om/hooks/rank-reflections.js";
import { fixtureReflections, fixtureObservations, fixtureBudget } from "../../../extensions/context/om/hooks/rank-reflections.fixture.js";
import { renderSummaryWithBudget } from "../../../extensions/context/om/session-ledger/render-summary.js";

const runtime = await ModelRuntime.create();
const events: Record<string, unknown>[] = [];
const order = await rankReflections({
	getAvailableOfType: runtime.getAvailableOfType.bind(runtime),
	classify: async (model, ...rest) => {
		if (model.id === RANKERS[0]!.id) throw new Error("forced failure of the first ranker");
		return runtime.classify(model, ...rest);
	},
}, fixtureReflections, fixtureObservations, undefined, { log: (event, data) => events.push({ event, ...data }) });
const retained = renderSummaryWithBudget(fixtureReflections, fixtureObservations, { maxTokens: fixtureBudget, reflectionOrder: order }).reflections.map((r) => r.id);
console.log(JSON.stringify({ events, order, retained }, null, 2));
if (!events.some((e) => e.event === "reflection_rank.ranked") || !retained.includes("role")) throw new Error("fallback ranker did not retain the role reflection");
