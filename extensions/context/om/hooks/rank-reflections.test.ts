import { expect, test } from "bun:test";
import type { ClassifierModel, ClassifierApi } from "@earendil-works/pi-ai";
import { renderSummaryWithBudget } from "../session-ledger/render-summary.js";
import { rankReflections } from "./rank-reflections.js";
import { fixtureReflections, fixtureObservations, fixtureBudget } from "./rank-reflections.fixture.js";

test("scripted Jev puts role and constraints before newer ordinary reflections", async () => {
	const model = { provider: "typesafe", id: "jev-latest" } as ClassifierModel<ClassifierApi>;
	const order = await rankReflections({
		getAvailableOfType: async () => [model] as never,
		classify: async (_, request) => {
			expect(request.state.recentObservations).toEqual(fixtureObservations.map(({ timestamp, content }) => ({ timestamp, content })));
			expect(Object.keys(request.questions)).toHaveLength(fixtureReflections.length * 2);
			return {
				api: "typesafe", provider: model.provider, model: model.id, stopReason: "stop", timestamp: Date.now(),
				answers: Object.fromEntries(fixtureReflections.flatMap((_, i) => [
					[`preserve_${i}`, { type: "bool", probability: i < 2 ? 1 : 0 }],
					[`relevance_${i}`, { type: "score", score: 1, confidence: 1 }],
				])),
			};
		},
	}, fixtureReflections, fixtureObservations);
	expect(order.slice(0, 2)).toEqual(["rule", "role"]);
	const out = renderSummaryWithBudget(fixtureReflections, fixtureObservations, { maxTokens: fixtureBudget, reflectionOrder: order });
	expect(out.omittedReflections).toBeGreaterThan(0);
	expect(out.reflections.map((r) => r.id)).toContain("role");
	expect(out.reflections.map((r) => r.id)).toContain("rule");
});

test("no Jev credential falls back to newest-first", async () => {
	const order = await rankReflections({
		getAvailableOfType: async () => [],
		classify: async () => { throw new Error("must not call Jev without credentials"); },
	}, fixtureReflections, fixtureObservations);
	expect(order).toEqual(fixtureReflections.map((r) => r.id).reverse());
	const out = renderSummaryWithBudget(fixtureReflections, fixtureObservations, { maxTokens: fixtureBudget, reflectionOrder: order });
	expect(out.reflections).toEqual(renderSummaryWithBudget(fixtureReflections, fixtureObservations, { maxTokens: fixtureBudget }).reflections);
	expect(out.reflections.map((r) => r.id)).not.toContain("role");
});
