import type { Issue } from "../tracker.ts";
import type { LandingLedger } from "./tracker-state.ts";

/** Private run view. done remains canonical; satisfied is collector-local. */
export interface ScheduledIssue extends Issue {
	blockers: string[];
	satisfied: boolean;
	provisional: boolean;
}
export interface SchedulingContext {
	root: string;
	into: string;
	landed: LandingLedger;
	/** Only recorded, active/adopting attempt tokens; never a prefix match. */
	attemptClaims: ReadonlySet<string>;
	/** Unaccepted owned descendants, including creates found after restart. */
	withheld: ReadonlySet<string>;
	/** Mirror the CLI's explicit-scope deferral exception for this selection. */
	explicit?: boolean;
}

/** Rebuild lifecycle rollups from ownStage/relations/guards and own claims.
 * No mutations of global rows and no branch or tracker IO. */
export function schedulingView(global: ReadonlyMap<string, Issue>, context: SchedulingContext): Map<string, ScheduledIssue> {
	const stages = ["idea", "goal", "spec", "ticket", "done"] as const;
	const children = new Map<string, Issue[]>();
	for (const row of global.values()) if (row.partOf) {
		const siblings = children.get(row.partOf) ?? [];
		siblings.push(row);
		children.set(row.partOf, siblings);
	}
	const seeded = (row: Issue) => !context.withheld.has(row.slug)
		&& (row.archived || row.done || context.landed[row.slug]?.into === context.into);
	const effective = new Map<string, Issue["effectiveStage"]>();
	const satisfied = new Map<string, boolean>();
	function resolve(row: Issue, path = new Set<string>()): void {
		if (effective.has(row.slug)) return;
		if (path.has(row.slug)) throw new Error(row.slug + ": part-of cycle");
		if (seeded(row)) {
			effective.set(row.slug, "done");
			satisfied.set(row.slug, true);
			return;
		}
		const kids = children.get(row.slug) ?? [];
		const next = new Set(path).add(row.slug);
		for (const kid of kids) resolve(kid, next);
		const stage = stages[Math.min(stages.indexOf(row.ownStage ?? "done"),
			...kids.map(kid => stages.indexOf(effective.get(kid.slug)!)))];
		effective.set(row.slug, stage);
		satisfied.set(row.slug, !context.withheld.has(row.slug) && stage === "done"
			&& kids.every(kid => satisfied.get(kid.slug)));
	}
	for (const row of global.values()) resolve(row);
	function subtree(row: Issue): Issue[] {
		return [row, ...(children.get(row.slug) ?? []).filter(kid => !kid.archived).flatMap(subtree)];
	}
	const ignoredClaims = new Set(["reconcile:" + context.root, ...context.attemptClaims]);
	const projected = new Map<string, ScheduledIssue>();
	for (const row of global.values()) {
		const scope = subtree(row);
		const slugs = new Set(scope.map(node => node.slug));
		const nodes = scope.filter(node => !node.archived && !satisfied.get(node.slug));
		const remaining = nodes.filter(node => node.ownStage !== null && node.ownStage !== "done");
		const blockers = [...new Set(nodes.flatMap(node => [
			...node.blockedBy.filter(slug => !slugs.has(slug) && !satisfied.get(slug)),
			...node.guards,
		]))];
		// Snapshot claims are already rolled up. Recover only each row's own stored
		// claims, then aggregate even satisfied children: landing doesn't release a reservation.
		const claims = scope.filter(node => !node.archived).flatMap(node => node.claims
			.filter(claim => claim.slug === node.slug && !claim.derived && !ignoredClaims.has(claim.claimedBy))
			.map(claim => ({ ...claim })));
		const selectors = remaining.map(node => ({ slug: node.slug, assignee: node.assignee }));
		const eligible = remaining.length > 0 && remaining.every(node => node.assignee === "agent"
			|| node.assignee?.startsWith("agent:") || node.assignee?.startsWith("model:"));
		const effectiveStage = effective.get(row.slug)!;
		const ready = effectiveStage === "spec" || effectiveStage === "ticket";
		const deferred = nodes.some(node => node.priority === 4);
		projected.set(row.slug, {
			...row, blockedBy: [...row.blockedBy], guards: [...row.guards],
			effectiveStage, satisfied: satisfied.get(row.slug)!, provisional: context.withheld.has(row.slug),
			ready, eligible, blockers, claims, selectors, deferred,
			frontier: !row.archived && ready && eligible && !blockers.length && !claims.length
				&& (context.explicit || !deferred) && !scope.some(node => context.withheld.has(node.slug)),
		});
	}
	return projected;
}
