import type { Tracker, TrackerOptions } from "./tracker.ts";

/** GitHub adapter selection and construction. Vault selection takes precedence
 * in getTracker. Return undefined when the canonical project's
 * docs/agents/issue-tracker.md does not name GitHub; malformed supported
 * configuration and transport failures throw, never select another tracker.
 *
 * Logical identities are gh-<number>, scoped to one native repository. run (or
 * PI_WM_RUN) selects private reconciler ownership/promotion receipts; native
 * assignment is the published claim. Snapshot caching is shared across this
 * repository's worktrees/CLI writers and invalidated by every adapter write.
 *
 * Filled serially by read-github-tracker-snapshots and
 * write-github-tracker-contracts before activation. */
export function getGithubTracker(_cwd: string, _options: TrackerOptions = {}): Tracker | undefined {
	throw new Error("GitHub Tracker adapter not implemented");
}
