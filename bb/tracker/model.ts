// The issue model both sides share: no Node imports, so app.tsx can bundle it.

/** One issue as the views need it: a projection of an \`issues.ts snapshot --json\` row plus where it lives. */
export interface Issue {
	slug: string;
	/** Path relative to the project root. */
	path: string;
	archived: boolean;
	legacy: boolean;
	ownStage: string | null;
	effectiveStage: string | null;
	assignee: string | null;
	priority: number | null;
	partOf: string | null;
	blockedBy: string[];
	guards: string[];
	ready: boolean;
	eligible: boolean;
	frontier: boolean;
	done: boolean;
	deferred: boolean;
	blockers: string[];
	claims: string[];
}

export interface Snapshot { root: string; repo: string; issues: Issue[]; at: number }

export const MENTION_PROVIDER = "issue";
/** Realtime channel: an issue file changed under \`{ root }\`. */
export const CHANGED = "issues-changed";

export function stageLabel(i: Issue): string {
	if (i.legacy) return "legacy";
	const own = i.ownStage ?? "container";
	return i.effectiveStage && i.effectiveStage !== i.ownStage ? own + " → " + i.effectiveStage : own;
}

/** Why an issue can't go to a supervisor now, in the tracker's terms. Supervision takes the frontier: a ready subtree,
 * unblocked, unclaimed, assigned to an agent. */
export function notReady(i: Issue): string {
	if (i.done) return "done";
	if (i.legacy) return "legacy issue";
	if (!i.ready) return "needs refining (" + stageLabel(i) + ")";
	const why = [];
	if (i.blockers.length) why.push("blocked by " + i.blockers.join(", "));
	if (i.claims.length) why.push("claimed by " + i.claims.join(", "));
	if (!i.eligible) why.push("not assigned to an agent (" + (i.assignee ?? "unassigned") + ")");
	if (i.deferred) why.push("deferred");
	return why.join("; ") || "not on the frontier";
}

/** A slug read as a title: the filename is the issue's title. */
export const title = (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1).replaceAll("-", " ");
