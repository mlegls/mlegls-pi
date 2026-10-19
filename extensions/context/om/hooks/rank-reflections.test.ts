import { expect, test } from "bun:test";
import type { ClassifierModel, ClassifierApi, ClassifierResult } from "@earendil-works/pi-ai";
import { renderSummaryWithBudget } from "../session-ledger/render-summary.js";
import { RANKERS, rankReflections } from "./rank-reflections.js";
import { fixtureReflections, fixtureObservations, fixtureBudget } from "./rank-reflections.fixture.js";

const models = RANKERS.map((m) => ({ ...m, type: "classifier" }) as unknown as ClassifierModel<ClassifierApi>);
const keepRoleAndRule = (model: ClassifierModel<ClassifierApi>): ClassifierResult => ({
	api: "typesafe-system-one", provider: model.provider, model: model.id, stopReason: "stop", timestamp: Date.now(),
	answers: Object.fromEntries(fixtureReflections.flatMap((_, i) => [
		[`preserve_${i}`, { type: "bool", probability: i < 2 ? 1 : 0 }],
		[`relevance_${i}`, { type: "score", score: 1, confidence: 1 }],
	])),
} as ClassifierResult);
const collect = () => {
	const events: { event: string; model?: unknown; reason?: unknown }[] = [];
	return { events, log: (event: string, data: Record<string, unknown>) => events.push({ event, model: data.model, reason: data.reason }) };
};

test("scripted Jev puts role and constraints before newer ordinary reflections", async () => {
	const { events, log } = collect();
	const order = await rankReflections({
		getAvailableOfType: async () => models as never,
		classify: async (model, request) => {
			expect(request.state.recentObservations).toEqual(fixtureObservations.map(({ timestamp, content }) => ({ timestamp, content })));
			expect(Object.keys(request.questions)).toHaveLength(fixtureReflections.length * 2);
			return keepRoleAndRule(model as ClassifierModel<ClassifierApi>);
		},
	}, fixtureReflections, fixtureObservations, undefined, { log });
	expect(order.slice(0, 2)).toEqual(["rule", "role"]);
	expect(events).toEqual([{ event: "reflection_rank.ranked", model: "openrouter/~typesafe/jev-latest", reason: undefined }]);
	const out = renderSummaryWithBudget(fixtureReflections, fixtureObservations, { maxTokens: fixtureBudget, reflectionOrder: order });
	expect(out.omittedReflections).toBeGreaterThan(0);
	expect(out.reflections.map((r) => r.id)).toContain("role");
	expect(out.reflections.map((r) => r.id)).toContain("rule");
});

test("a failing model moves ranking to the next one", async () => {
	const { events, log } = collect();
	const order = await rankReflections({
		getAvailableOfType: async () => models as never,
		classify: async (model) => {
			if (model.id === RANKERS[0]!.id) throw new Error("Jev down");
			return keepRoleAndRule(model as ClassifierModel<ClassifierApi>);
		},
	}, fixtureReflections, fixtureObservations, undefined, { log });
	expect(order.slice(0, 2)).toEqual(["rule", "role"]);
	expect(events).toEqual([
		{ event: "reflection_rank.attempt_failed", model: "openrouter/~typesafe/jev-latest", reason: "Jev down" },
		{ event: "reflection_rank.ranked", model: "openrouter/cloudflare/clef", reason: undefined },
	]);
});

test("every model failing gives newest-first", async () => {
	const { events, log } = collect();
	const order = await rankReflections({
		getAvailableOfType: async () => models as never,
		classify: async (model) => ({ ...keepRoleAndRule(model as ClassifierModel<ClassifierApi>), answers: {} }),
	}, fixtureReflections, fixtureObservations, undefined, { log });
	expect(order).toEqual(fixtureReflections.map((r) => r.id).reverse());
	expect(events.map((e) => e.model)).toEqual([...RANKERS.map((m) => `${m.provider}/${m.id}`), "newest-first"]);
});

test("no OpenRouter credential falls back to newest-first", async () => {
	const { events, log } = collect();
	const order = await rankReflections({
		getAvailableOfType: async () => [],
		classify: async () => { throw new Error("must not classify without credentials"); },
	}, fixtureReflections, fixtureObservations, undefined, { log });
	expect(order).toEqual(fixtureReflections.map((r) => r.id).reverse());
	expect(events.at(-1)).toEqual({ event: "reflection_rank.fallback", model: "newest-first", reason: "every model failed" });
	const out = renderSummaryWithBudget(fixtureReflections, fixtureObservations, { maxTokens: fixtureBudget, reflectionOrder: order });
	expect(out.reflections).toEqual(renderSummaryWithBudget(fixtureReflections, fixtureObservations, { maxTokens: fixtureBudget }).reflections);
	expect(out.reflections.map((r) => r.id)).not.toContain("role");
});
