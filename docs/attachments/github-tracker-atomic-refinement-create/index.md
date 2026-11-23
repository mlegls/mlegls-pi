# GitHub tracker: atomic refinement create (review)

Change 448cbf66..5a6ca956. Drive was skipped (no declared drivePaths/renderedPaths touched); this review is the only pass before integration.

## Stories and what established them

All checks ran on the review head with `bun test lib/tracker-github.test.ts` (9 pass, 64 expects) and `bunx tsc --noEmit -p .` (exit 0).

| story | outcome | evidence |
| --- | --- | --- |
| stable-claim create is authorized only from a saved `accepting` attempt whose `landedHead` reaches the destination HEAD, whose parent lies in the attempt's subtree, and whose request equals `resolveProposedChild` output | held | test "only a landed proposal creates claimed children; replay correlates per parent": refusals with no refinement, `phase: writing`, node outside subtree (`gh-2`), missing `landedHead`, a changed body |
| provisional-token creates are refused | held | same test: `claimed-by: reconcile:r1/h1` throws |
| siblings in dependency order; second's `blocked-by` is the first's `gh-N` | held | same test: `next` created after `created.base = gh-5`, snapshot shows `blockedBy: [gh-5]` |
| lost `createIssue` response replays to the same `gh-N` | held | same test: fault `lose: [createIssue]`, retry returns `gh-5`, one `createIssue` call |
| identical aliases under two refined parents in one run don't collide | held | same test: alias `base` under `gh-2` creates `gh-7`; replay of `base` under `gh-1` still returns `gh-5`; 3 `createIssue` calls total |
| provisional authority removed (attempt tokens, claim transfers, `remove`, `removes` journal, `removing` receipt) | held | diff review; `lib/reconcile/tracker-state.ts` untouched as the ticket asks |

Manual first use: `bun lib/fixtures/github-acceptance.ts` creates and replays one accepted child (same `gh-2` twice); `bun lib/fixtures/github-acceptance.ts reconcile:gh-1/h1` is refused.

## Review notes

- Journal correlation key now includes `parentId`; existing intents are found by the field filter, so older keys still correlate.
- `refinement.ts` `discard` still calls `tracker.remove`, which now throws on GitHub. Provisional GitHub children can no longer exist, so the call is unreachable there; the reconciler-side cleanup belongs to the sibling refinement ticket and the parent join.
