# Landing a reconciled tree through a pull request

Requires an owned GitHub repo with `gh` auth, push access, a fetched default branch, and checks. For GitHub-tracked issues (`# Issue tracker: GitHub` in `docs/agents/issue-tracker.md` plus `docs/agents/triage-labels.md`; local `docs/issues/` wins if present), pass `gh-<number>` as `ROOT`. Note that GitHub blocks self-review, so another authorized reviewer must approve or request changes.

## Landing mode and paths

Configure `.pi/reconcile.json` in the owner checkout:

```json
{
  "land": "pr-review",
  "renderedPaths": ["packages/web/src/**", "landing/**", "packages/web/official/**/*.html", "*.css"],
  "drivePaths": ["bin/**"]
}
```

- `land`: `local` (default), `pr-merge`, or `pr-review`. Overridable at start via `reconcile({ land })` or CLI `--land`. Resume preserves the saved mode and refuses a conflicting override.
- `renderedPaths` / `drivePaths`: repo-relative globs (no slash matches basenames at any depth). Touching either triggers `drive`; touching `renderedPaths` with visual evidence routes review to `visual-reviewer` (joins still use `tidy`).

CLI equivalents:

```sh
bun lib/reconcile/main.ts start ROOT --owner thr_OWNER --budget 1 --land pr-merge --cwd /absolute/owner-checkout
bun lib/reconcile/main.ts status --cwd /absolute/owner-checkout
```

After a crash, re-run `start` to resume; `stop` explicitly retires workers and marks the run stopped.

## PR wait behavior

Children land in collectors, then the root lands in a run-owned PR staging branch/worktree. Siblings can proceed while the PR waits, while external dependents and global issue status wait for remote merge. Ordinary workers retire during the wait; the reconciler polls about once a minute.

Failing checks trigger bounded repair (shared budget: 2 repair workers, 3 integration attempts). Base and contributor updates merge into history without rebasing or force-pushing.

- **`pr-merge`**: requests a head-guarded merge commit once every reported check passes (including when no checks are configured). Choosing this authorizes any deploy workflow triggered by merge.
- **`pr-review`**: never merges. A submitted review with unresolved inline threads triggers one automatic repair round and replies on each thread; ordinary PR comments don't, and a subsequent changes-requested review escalates to the owner.

## Exceptions and completion

Inspect `status` before resolving. Closed-unmerged PRs and transient GitHub transport errors raise owner exceptions without closing issues. Reopen (if closed) and acknowledge via `answer` to resume observing the same PR:

```sh
bun lib/reconcile/main.ts resolve ROOT ROOT '{"action":"answer","note":"Reopened; await human merge"}' --cwd /absolute/owner-checkout
```

Use `retry` only after inspecting a failed repair's saved receipt/budget.

Only `MERGED` metadata plus fetched base ancestry closes carried issues (child-first, preserving original review packets). Afterwards, a clean owner checkout on the base branch fast-forwards best-effort; dirty or other-branch checkouts are left alone.

For current BB-based local reconciliation, see [move-coordination-off-the-board](../attachments/move-coordination-off-the-board/index.md).
