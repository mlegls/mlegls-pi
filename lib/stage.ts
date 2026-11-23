/** The tracker's one boundary: an issue is `ready` once there is enough consensus that the rest happens autonomously.
 * Stages order a meet-semilattice over the part-of tree; an omitted stage (a pure container) is the top, `done`. */
export const STAGES = ["idea", "ready", "done"] as const;
export type Stage = (typeof STAGES)[number];

/** Pre-2026-11-23 names, still read and accepted on writes. `spec` was `ready` that starts by decomposing. */
export const LEGACY_STAGES: Readonly<Record<string, Stage>> = { goal: "idea", spec: "ready", ticket: "ready" };

export const knownStage = (value: unknown): boolean =>
	typeof value === "string" && ((STAGES as readonly string[]).includes(value) || Object.hasOwn(LEGACY_STAGES, value));

export function normalizeStage(value: unknown): Stage | undefined {
	if (typeof value !== "string") return undefined;
	if ((STAGES as readonly string[]).includes(value)) return value as Stage;
	return Object.hasOwn(LEGACY_STAGES, value) ? LEGACY_STAGES[value] : undefined;
}

/** Rewrite legacy stage names in a field set. Unless the set gives decompose, `spec` becomes `ready` with
 * `decompose: true` and `ticket` becomes `ready` without it (null, which a write takes as removing the key). */
export function normalizeStageFields<T extends Record<string, unknown>>(fields: T): T {
	if (typeof fields.stage !== "string" || !Object.hasOwn(LEGACY_STAGES, fields.stage)) return fields;
	const out: Record<string, unknown> = { ...fields, stage: LEGACY_STAGES[fields.stage] };
	if (fields.stage !== "goal" && typeof fields.decompose !== "boolean") out.decompose = fields.stage === "spec" ? true : null;
	return out as T;
}
