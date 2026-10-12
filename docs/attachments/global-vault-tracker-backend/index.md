# Global vault backend first use

## Setup and replay

Required and prepared target: an isolated local git repository with its own canonical vault, linked shell-fixture worker, and a deliberately forbidden branch. No models, credentials, BB threads or services. The fixture sets its own git author (`Vault fixture` / `vault-fixture@example.invalid`) and provenance (`session:scratch-vault`), not inherited deployment selectors.

From a checkout of this implementation:

```sh
mise run setup
bun docs/attachments/global-vault-tracker-backend/rehearse.ts
```

The runnable entry is [rehearse.ts](rehearse.ts). It creates a short-lived `vault-first-use-*` directory with `main`, `worker`, `forbidden`, and a fixture vault. Readiness is observed after seed commit, linked `--no-checkout` worktree creation, and explicit sparse preparation. It uses this checkout's bundled CLI and library, clearing `TRACKER_CLI`/inflight overrides inside the fixture process.

Cleanup runs in `finally`: remove only the fixture worktrees through their owning main repo, then remove that one temp directory. There are no resident processes. If the script is forcibly interrupted before `finally`, remove the printed fixture directory; do not touch other worktrees or kill processes by pattern.

## Encounter

Tested backend revision: `6d0bfdb2` (on implementation base `294a02bf`); the final packet revision adds concurrent-write and persistence-failure observations without changing the backend. The corrected rehearsal completed successfully. The first fixture attempt accidentally made a child both part of and blocked by its parent: the existing completion-cycle validator correctly refused it. The seed was corrected to add that blocker only after detaching the parent relation.

| Claim | Action and observed result |
| --- | --- |
| Sparse canonical reads | Explicit exclusion left no physical `docs/issues/`, kept `docs/attachments/seed.txt`, and produced no tracked deletions. A shell worker ran `snapshot --json`; library, subdirectory and issue-symlink reads returned the canonical seed. |
| Shared writes without a code-HEAD change | Created a child from the sparse worker; `fields` returned logical slugs and nested extra metadata, while storage used quoted vault links. Updating seed priority was visible through the existing library adapter's next snapshot, with the worker HEAD unchanged. |
| Field/body contract | Field-only update preserved the seed body and immutable provenance, removed a null-valued key, and body-file replacement resolved in the calling worker. A supplied empty body replaced the whole body. |
| Invalid writes are inert | A self-blocking update reported `blockedBy cycle`, with issue text and canonical HEAD unchanged. Author mutation and `../escape` creation were rejected. |
| Close and remove | Close wrote live `stage: done`, dropped the claim, removed only the issue blocker and retained `approval: maintainer`. Evidence referenced `docs/attachments/result.md`, which existed only in the worker and was not copied. Replaying close changed neither text nor canonical HEAD. Owned provisional creation/removal left no issue. |
| Serialized and path-limited persistence | Two concurrent CLI processes merged distinct fields on the same issue; both values survived. The unrelated `sentinel.txt` remained staged throughout and never appeared in commit history. An owned fixture pre-commit hook then deliberately refused persistence: the diagnostic began `Validated tracker working-tree write happened`, the validated field was visible, and canonical HEAD stayed unchanged. The fixture removed its hook and reverted that probe field through the API. |
| Landing refusal | A code/evidence-only commit was accepted despite later canonical persistence. The separate bad branch added `hidden.txt`, modified `seed.md`, and deleted `child.md` under `docs/issues/`; refusal named all three paths and said mutations belong through the tracker. Destination status and HEAD were unchanged. |

Nonvisual CLI/library evidence; no screenshots. This is runnable setup and encounter evidence, not another retained test suite. Runtime activation and connected ledger stories remain the next child's work.

## Existing regressions

```sh
bun test skills/enabled/all/mlegls/conventions/tracker/scripts
bun test lib/thread/runtime.test.ts lib/thread/lifecycle.test.ts lib/reconcile/landing.test.ts
bunx tsc --noEmit
```

Observed: 23 tracker tests and 13 thread/landing tests passed; typecheck passed. After routing `check --fix` through the same canonical lock/validation/publication/persistence machinery, the 23 tracker tests, typecheck and full scratch replay passed again. Non-tracker documentation repairs still stay in the checked code tree; canonical issue repairs alone enter tracker persistence. No new tests were added. Changed existing assertions: `worktree links use canonical issues and branch evidence; foreign projects retain vault state` now accepts canonical issue targets despite branch deletion/archive edits, repairs an archived link back to the live canonical identity, and retains branch-specific heading/attachment plus foreign-project assertions. Branch-runtime assertions were not weakened.
