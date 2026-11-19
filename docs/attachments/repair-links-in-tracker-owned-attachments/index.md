# Repairing links in tracker-owned attachments

## Predictions before first use

As a worker in a linked worktree, I expect the vault check to name the Markdown attachment containing a dangling link. I expect to pass that attachment identifier to the global tracker, read the packet, change the stale link there, and see the change in the canonical vault. On recheck, the repaired citation should no longer be reported. Direct worktree access should still be guarded, and accepting an attachment identifier should not give me a way to bypass ownership checks on issues.

## Setup

Tested revision: `ab55a16d`. From the checkout root, run `bash docs/attachments/repair-links-in-tracker-owned-attachments/drive.sh`. The handoff describes a disposable local Common Concept vault and linked worker worktree seeded at `73dabc569416a5b6add49110440c1bd33d4be279`, using local Git and Bun without credentials or network services. The launcher checked out the seed in a temporary clone, created a linked worker, and ran the tracker from the worker against that clone’s vault. The first check reached the seeded state and reported the expected dangling link. The launcher removed both temporary directories on exit.

## Encounter and replay checks

| Action | Expected and observed |
| --- | --- |
| Run `check` from the linked worker. | Met: the diagnostic named `issues/attachments/browser-replay-rulings/study.md` and reported that its relative `study-fixtures.ts` link did not exist. |
| Pass that exact identifier to `text`. | Met: it returned the Markdown including the broken citation. No translating the reported path to an issue slug. |
| Replace the stale relative URL with a revision-pinned URL and pass the Markdown to `update issues/attachments/browser-replay-rulings/study.md --body-file -`. Run `check` again. | Met: zero diagnostics remained for that attachment. The canonical clone’s latest commit changed only `docs/issues/attachments/browser-replay-rulings/study.md` (one line replaced); the worker’s `git status --short` was empty. This was a CLI link-diagnostic check; the external URL was not visited. |
| Try to open the attachment directly with `read` in the reconciled drive checkout. | Met: the worktree guard returned “Use the global tracker” instead of file content. |
| In a fresh disposable clone and linked worker with the same seed, run `update issues/attachments/browser-replay-rulings/study.md --fields '{"claimed-by":"session:attachment-drive-probe"}'`. | Met: exit 1, “attachment updates require --body-file and do not accept --fields.” Canonical HEAD stayed at the seed and both working trees remained clean. This checks that the attachment update route cannot set issue metadata. |

No blocking friction in the CLI journey. The direct-open refusal uses the generic `<slug>` hint; the path emitted by `check` worked verbatim.

## Review replay

Replayed `drive.sh` at `f62eda91`: the nested locator worked unchanged, the canonical commit touched only `study.md`, the worker stayed clean, and the recheck counted zero findings for that packet. The guard hook loaded from this revision blocked a direct attachment read and suggested `text <slug|attachments/file.md>`; the slug-only hint seen in the first drive is already corrected. The 49 existing guard, tracker CLI, persistence, and GitHub adapter checks passed.
