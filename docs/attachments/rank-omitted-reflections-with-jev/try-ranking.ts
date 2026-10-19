// Library first-use fixture; uses pi's usual provider authentication, never prints credentials.
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import type { ClassifierResult } from "@earendil-works/pi-ai";
import { rankReflections } from "../../../extensions/context/om/hooks/rank-reflections.js";
import { fixtureReflections, fixtureObservations, fixtureBudget } from "../../../extensions/context/om/hooks/rank-reflections.fixture.js";
import { renderSummaryWithBudget } from "../../../extensions/context/om/session-ledger/render-summary.js";

const runtime = await ModelRuntime.create();
let result: ClassifierResult | undefined;
const started = performance.now();
const order = await rankReflections({
	getAvailableOfType: runtime.getAvailableOfType.bind(runtime),
	classify: async (...args) => result = await runtime.classify(...args),
}, fixtureReflections, fixtureObservations);
const latencyMs = Math.round(performance.now() - started);
const ranked = renderSummaryWithBudget(fixtureReflections, fixtureObservations, { maxTokens: fixtureBudget, reflectionOrder: order });
const fallback = renderSummaryWithBudget(fixtureReflections, fixtureObservations, { maxTokens: fixtureBudget });
console.log(JSON.stringify({
	provider: result?.provider, model: result?.model, stopReason: result?.stopReason,
	latencyMs, usage: result?.usage, order,
	retained: ranked.reflections.map((r) => r.id), omitted: ranked.omittedReflections,
	newestFirstRetained: fallback.reflections.map((r) => r.id),
}, null, 2));
if (result?.stopReason !== "stop" || !ranked.reflections.some((r) => r.id === "role")) {
	throw new Error("Live Jev fixture did not retain the role reflection");
}
