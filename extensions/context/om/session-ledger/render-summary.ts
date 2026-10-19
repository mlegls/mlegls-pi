import type { Observation, Reflection } from "./types.js";

const CONTEXT_USAGE_INSTRUCTIONS = `These are condensed memories from earlier in this session.

- Reflections: stable, long-lived facts about the user, project, decisions, and constraints. New reflection lines may include ids in brackets.
- Observations: timestamped events from the conversation history, in chronological order. Observation lines include ids in brackets.

Treat these as past records. When entries conflict, the most recent observation reflects the latest known state. Work that prior observations describe as completed should not be redone unless the user explicitly asks to revisit it.

When exact source context is needed for precision or traceability, use the recall tool with the relevant observation or reflection id. This is especially useful when a reflection materially affects a decision or is too compressed to continue confidently. Do not use recall as broad search or inject raw source unless it is needed.`;

export function observationToSummaryLine(observation: Observation): string {
	return `[${observation.id}] ${observation.timestamp} [${observation.relevance}] ${observation.content}`;
}

export function reflectionToSummaryLine(reflection: Reflection): string {
	return `[${reflection.id}] ${reflection.content}`;
}

export type RenderSummaryOptions = {
	/**
	 * Estimated token budget for the rendered summary. Observations are
	 * guaranteed at least half of it (newest first); reflections take the rest
	 * (preservation floor first, then newest first), and unused space is shared.
	 * Omitted records stay in the session ledger and remain visible through
	 * `/om:view full`.
	 */
	maxTokens?: number;
};

/** Share of the summary budget reserved for observations before reflections are allocated. */
export const SUMMARY_OBSERVATIONS_MIN_SHARE = 0.5;

export type RenderedSummary = {
	text: string;
	reflections: Reflection[];
	observations: Observation[];
	omittedReflections: number;
	omittedObservations: number;
};

function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

// Conservative, credential-free counterpart of the condenser prompt's preservation floor.
// Prefer false positives to forgetting a role, permission, rule, or unresolved decision.
const PRESERVATION_FLOOR = [
	/\b(role|identity|supervisor|coordinator)\b|\b(?:session|user)\s+(?:is|acts as|serves as|owns|works|name)\b/i,
	/\b(prefer\w*|wants?|permissions?|permitted|allows?|allowed|authoriz\w*)\b|\bwithout (?:asking|approval|confirmation)\b/i,
	/\b(must|never|always|only|should|cannot|can't|constraints?|rules?|requires?|required|forbidden)\b|\bdo(?:es)? not\b|\bdon't\b|^(?:use|keep|avoid|ask)\b/i,
	/\b(blocks?|blocked|blockers?|waiting|awaiting|pending|unresolved|undecided)\b/i,
	/\b(decided|decision|chosen|chose|rationale|because|architecture|architectural)\b/i,
];

function preserveReflection(reflection: Reflection): boolean {
	return PRESERVATION_FLOOR.some((pattern) => pattern.test(reflection.content));
}

/** Priority first, newest-first within each priority; return records in original order. */
function selectWithinBudget<T>(records: T[], line: (record: T) => string, budget: number, priority?: (record: T) => boolean): { kept: T[]; tokens: number } {
	const keptIndexes: number[] = [];
	const indexes = Array.from(records.keys()).reverse();
	if (priority) indexes.sort((a, b) => Number(priority(records[b])) - Number(priority(records[a])));
	let tokens = 0;
	for (const i of indexes) {
		const cost = estimateTokens(line(records[i])) + 1;
		// Skip a record that does not fit instead of stopping: a single long
		// newest record must not hide shorter older ones that still fit.
		if (tokens + cost > budget) continue;
		tokens += cost;
		keptIndexes.push(i);
	}
	keptIndexes.sort((a, b) => a - b);
	return { kept: keptIndexes.map((i) => records[i]), tokens };
}

export function renderSummaryWithBudget(
	reflections: Reflection[],
	observations: Observation[],
	options: RenderSummaryOptions = {},
): RenderedSummary {
	if (reflections.length === 0 && observations.length === 0) {
		return { text: "", reflections: [], observations: [], omittedReflections: 0, omittedObservations: 0 };
	}

	let keptReflections = reflections;
	let keptObservations = observations;
	const maxTokens = options.maxTokens;
	if (maxTokens !== undefined && Number.isFinite(maxTokens) && maxTokens > 0) {
		const fixed = estimateTokens(CONTEXT_USAGE_INSTRUCTIONS) + estimateTokens("## Reflections\n## Observations\n\n\n\n") + 40;
		const budget = Math.max(0, maxTokens - fixed);
		// Observations are the chronological record and must not be crowded out
		// by verbose reflections: reserve them a share first, give reflections
		// the remainder, then let observations reclaim whatever reflections left.
		const reserved = selectWithinBudget(observations, observationToSummaryLine, Math.floor(budget * SUMMARY_OBSERVATIONS_MIN_SHARE));
		// Jev needs separate classifier credentials, which a working compaction session need not
		// have. Keep this synchronous backstop credential-free: preservation floor, then recency.
		const pickedReflections = selectWithinBudget(reflections, reflectionToSummaryLine, budget - reserved.tokens, preserveReflection);
		keptReflections = pickedReflections.kept;
		keptObservations = selectWithinBudget(observations, observationToSummaryLine, budget - pickedReflections.tokens).kept;
	}

	const omittedReflections = reflections.length - keptReflections.length;
	const omittedObservations = observations.length - keptObservations.length;
	const parts: string[] = [CONTEXT_USAGE_INSTRUCTIONS];
	if (keptReflections.length > 0) {
		parts.push(`## Reflections\n${keptReflections.map(reflectionToSummaryLine).join("\n")}`);
	}
	if (keptObservations.length > 0) {
		parts.push(`## Observations\n${keptObservations.map(observationToSummaryLine).join("\n")}`);
	}
	if (omittedReflections > 0 || omittedObservations > 0) {
		const omitted: string[] = [];
		if (omittedReflections > 0) omitted.push(`${omittedReflections} reflection${omittedReflections === 1 ? "" : "s"}`);
		if (omittedObservations > 0) omitted.push(`${omittedObservations} older observation${omittedObservations === 1 ? "" : "s"}`);
		parts.push(`(${omitted.join(" and ")} omitted to fit the summary budget; they remain in the session memory ledger, see /om:view full.)`);
	}
	return {
		text: parts.join("\n\n"),
		reflections: keptReflections,
		observations: keptObservations,
		omittedReflections,
		omittedObservations,
	};
}

export function renderSummary(reflections: Reflection[], observations: Observation[], options: RenderSummaryOptions = {}): string {
	return renderSummaryWithBudget(reflections, observations, options).text;
}
