import { expect, test } from "bun:test";
import { DEFAULTS, resolveCompactionSummaryMaxTokens, resolveReflectionPoolBudget } from "../config.js";
import { renderSummaryWithBudget } from "./render-summary.js";
import type { Reflection } from "./types.js";

const refl = (id: string, content: string): Reflection => ({ id, content, supportingObservationIds: [], tokenCount: Math.ceil(content.length / 4) });

test("reflection budget derives from the session's summary budget; explicit values win independently", () => {
	const small = resolveReflectionPoolBudget(DEFAULTS, 200_000);
	expect(small.maxTokens).toBe(Math.floor(resolveCompactionSummaryMaxTokens(DEFAULTS, 200_000) / 2));
	expect(small.targetTokens).toBe(Math.floor(small.maxTokens * 0.75));
	expect(resolveReflectionPoolBudget(DEFAULTS, 1_000_000).maxTokens).toBeGreaterThan(small.maxTokens);
	expect(resolveReflectionPoolBudget({ ...DEFAULTS, reflectionsPoolMaxTokens: 1000 }, 200_000)).toEqual({ maxTokens: 1000, targetTokens: 750 });
	expect(resolveReflectionPoolBudget({ ...DEFAULTS, reflectionsPoolTargetTokens: 500 }, 200_000)).toEqual({ maxTokens: small.maxTokens, targetTokens: 500 });
});

test("omission honours supplied reflection priority while displaying chronological order", () => {
	const filler = (i: number) => refl(`f${i}`, `Ordinary note ${i} about the parser internals. `.repeat(8));
	const role = refl("role", "This session is the persistent top-level supervisor for the repo.");
	const rule = refl("rule", "The user never wants force pushes to main.");
	const reflections = [role, filler(0), rule, ...Array.from({ length: 40 }, (_, i) => filler(i + 1))];
	const out = renderSummaryWithBudget(reflections, [], { maxTokens: 800, reflectionOrder: ["role", "rule", "f0"] });
	expect(out.omittedReflections).toBeGreaterThan(0);
	expect(out.reflections.map((r) => r.id)).toContain("role");
	expect(out.reflections.map((r) => r.id)).toContain("rule");
	expect(out.reflections.map((r) => r.id)).toContain("f40");
	expect(out.reflections.map((r) => r.id)).toContain("f0");
	expect(out.reflections.map((r) => r.id)).not.toContain("f1");
	const order = out.reflections.map((r) => reflections.indexOf(r));
	expect(order).toEqual([...order].sort((a, b) => a - b));
});
