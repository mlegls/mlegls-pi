# Independent drive

Predictions before opening the surface (2026-10-14)

- Project discovery will identify the handed-off disposable repository, origin and main.
- Creating a fresh scratch branch PR will preserve exact title/body/base/head; find will recover the same PR without another create.
- Observe will expose branch OIDs, state, reviews/threads and checks. A fresh commit will have empty checks, while an invalid OID will throw rather than appear empty.
- Reporting failure then success for one status context will expose only the latest success, including in the PR snapshot.
- Closing through gh will leave the same PR discoverable as CLOSED.

Setup: live GitHub API plus local Bun, existing mlegls gh login; explicitly supplied disposable target mlegls/reconcile-pr-transport-20261014-35767b2d (implementer-owned, authorized by handoff). Fresh drive branch will isolate writes from retained PR #1. No production target, UI or server. Reply and guarded merge live journeys belong to rehearse-reconciled-github-pr-landings.

## Encounter and results

Tested revision: `75b267a96b8965eec4763ba93117943c6a6bc710`. Readiness: `gh auth status` succeeded using existing keyring login; `gh repo view mlegls/reconcile-pr-transport-20261014-35767b2d --json nameWithOwner,defaultBranchRef,description` confirmed the disposable owner description and main; clone and fetch succeeded. Local target `.wm/pr-transport-scratch` belongs to this drive checkout.

Setup commands:

```sh
gh repo clone mlegls/reconcile-pr-transport-20261014-35767b2d .wm/pr-transport-scratch
git -C .wm/pr-transport-scratch fetch origin main
git -C .wm/pr-transport-scratch switch -c transport-independent-drive-3
git -C .wm/pr-transport-scratch -c user.name='Transport verifier' -c user.email='transport-verifier@example.invalid' commit --allow-empty -m 'Independent transport drive'
git -C .wm/pr-transport-scratch push -u origin transport-independent-drive-3
bun .wm/independent-drive.ts
```

The one-off library probe completed successfully in 82 seconds. It created [PR #2](https://github.com/mlegls/reconcile-pr-transport-20261014-35767b2d/pull/2), found and observed it, compared REST readback with exact caller strings, posted failure/success statuses, and closed through ordinary `gh pr close`. No fixtures or mocked transport were used.

| Prediction / replayable check | Observed result | Outcome |
| --- | --- | --- |
| Call project on cloned checkout | repository matches supplied target; origin; main | met |
| Create once, then find without persisting identity; compare REST title/body/head/base | same OPEN #2; exact strings preserved, including newline, dollar sign and backticks | met |
| Observe exact branch identities | head `a03026087e495946e4fec3b307fd0b3d0ba1aa4c`; base `3ed5a61a91a2062dd19561fd65d4f3c87db2a11a`; MERGEABLE; empty reviews/threads | met |
| Query checks on new head, then nonexistent all-zero OID | `[]` versus thrown `No commit found for SHA ... (HTTP 422)` | met |
| POST failure then success to drive/probe on exact head; query checks and observe | failure ID `56321101107` normalized fail; only success ID `56321107748` remained, normalized pass, URL PR #2, details `success: Latest success`, snapshot agreed | met |
| Close #2 and find branch again | same #2 CLOSED, unmerged | met |

Frictions: none observed on this journey. No new expectation arose unmet. Replay checks are the rows above; their accepted results are explicit. A fresh mutation replay must use a new owned branch/commit; the retained branch already has a closed PR and must not create a replacement. A read-only replay can reuse the fresh-verifier command in index.md with `transport-independent-drive-3` substituted.

Limits: nonempty reviews, nested thread pagination, actual check runs and guarded merge/reply were not exercised live here; implementation packet distinguishes seeded evidence, and live lifecycle rehearsal owns merge/reply. No unit tests or source inspection by this driver.

Cleanup: PR #2 closed successfully in a finally block. No server/browser/deployment/process remains running. Disposable repository, branch and statuses retained for review, alongside PR #1. Repository owner can delete it using the instructions in index.md; local clone retires with this worktree.
