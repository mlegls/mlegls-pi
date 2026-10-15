# Issue tracker: GitHub

The [vault](issue-tracker-vault.md) lifecycle over native GitHub issues. Select `# Issue tracker: GitHub` in the canonical project's `docs/agents/issue-tracker.md`; `docs/agents/triage-labels.md` maps needs-triage, needs-info, ready-for-agent, ready-for-human and wontfix to repository labels. Canonical `docs/issues/` takes precedence, including from sparse linked checkouts.

Use the global tracker CLI with `gh-<number>` identities:

```sh
bun "$TRACKER_CLI" snapshot gh-123 --json
bun "$TRACKER_CLI" text gh-123
bun "$TRACKER_CLI" fields gh-123 --json
bun "$TRACKER_CLI" create requested-name --fields '{"title":"Contract","assignee":"agent"}' --body-file contract.md
bun "$TRACKER_CLI" update gh-123 --fields '{"priority":2}'
bun "$TRACKER_CLI" update gh-123 --body-file - < contract.md
bun "$TRACKER_CLI" close gh-123 --summary 'Accepted at target' --evidence docs/attachments/result/index.md
```

`TRACKER_CLI` is the bundled `skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts` (workers inherit its pinned path). Create returns the actual gh identity; its requested name is a replay alias, not the native identity. Author comes from `author` or `PI_SESSION_ID`. Update accepts fields and/or whole body; null removes a field. `remove` is only for provisional children owned by the caller. Snapshot JSON has lifecycle issues and an empty legacy list; ancillary vault verbs are unsupported here.

An open ready-for-agent root with no children infers spec; a child infers ticket; a parent's residual is omitted when it has children. Explicit promotion/delegation receipts preserve refinement. Human/not-ready triage and native closure gate these receipts. Priority is the repository's `p1|p2|p3` label. Part-of and blocked-by use native sub-issues/dependencies; configured fallback headers are `Part of #n` / `Blocked by: #n` atop the body. Native assignment plus an exact private run receipt establishes ownership, not a matching login alone.

Record decisions and friction through the global backend. Under reconciliation, create provisional children with the supplied exact attempt token and part-of atomically. Hand off results; the reconciler closes child-first after actual target landing, not collector/staging integration. Assignments persist while pending target. Supervised move-out publishes mapped human readiness, reason and unassignment. Code/evidence stay on worker branches.

GitHub's API budget is shared with all other `gh` use on the account. When it is exhausted, every command fails with `GitHub tracker: API rate limit exhausted until <time>` and no process calls `gh` before that reset; the reconciler holds every node until then, noting it once rather than raising an exception.

Native escape hatches remain useful: `gh-axi issue view <n> --comments --full`, `gh-axi issue list --state open`, `gh-axi issue subissue add <parent> <child>`, or the dependency API `POST /repos/<o>/<r>/issues/<child>/dependencies/blocked_by` with `{"issue_id": <blocker database id>}`. PRs share the number space but are not tracker intake contracts.
