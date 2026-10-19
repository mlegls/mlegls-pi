import type { Observation, Reflection } from "../session-ledger/types.js";

const reflection = (id: string, content: string): Reflection => ({ id, content, supportingObservationIds: [], tokenCount: Math.ceil(content.length / 4) });
export const fixtureReflections = [
	reflection("role", "This session is the persistent top-level supervisor for the repo."),
	reflection("rule", "The user never wants force pushes to main."),
	...Array.from({ length: 12 }, (_, i) => reflection(`f${i}`, `Ordinary note ${i} about the parser internals. `.repeat(8))),
];
export const fixtureObservations: Observation[] = [{
	id: "current", timestamp: "2026-10-19T12:00:00Z", relevance: "high", sourceEntryIds: [], tokenCount: 20,
	content: "Current work: rank omitted OM reflections with Jev before compaction rendering.",
}];
export const fixtureBudget = 600;
