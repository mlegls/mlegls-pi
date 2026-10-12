/** Worktree/landing seam; implementation belongs to global-vault-tracker-backend. */

/** Exclude docs/issues/ from this worker or collector before prepare/setup/launch.
 * Other paths, including docs/attachments/, stay checked out. */
export function excludeTracker(_cwd: string): void {
	throw new Error("Sparse tracker exclusion not implemented: global-vault-tracker-backend");
}

/** Refuse changes authored by source relative to target (merge-base diff), before
 * rebase/merge can overwrite the global tracker. Recheck after preparation.
 * Canonical tracker persistence already inherited from target is not a source edit. */
export function assertNoTrackerChanges(_cwd: string, _target: string, _source = "HEAD"): void {
	throw new Error("Tracker landing refusal not implemented: global-vault-tracker-backend");
}
