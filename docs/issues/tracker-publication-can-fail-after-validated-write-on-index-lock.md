---
stage: "idea"
assignee: "agent"
author: "session:01a13266-16c3-75a9-a1b7-228c6e73b0a7"
---
---
stage: "idea"
assignee: "agent"
author: "session:01a13266-16c3-75a9-a1b7-228c6e73b0a7"
---
Tracker update can write a validated canonical issue body and then fail to publish it while another operation holds the canonical Git index lock.

Observed during consolidate-the-tutor-tool-catalog handler 2c on 2026-10-13: repeated `issues.ts update retarget-scripted-harness-and-scene-entrypoints --body-file /tmp/consolidate-handler-2c-ruling.md` returned `Validated tracker working-tree write happened; publication/persistence failed` and `fatal: Unable to create '/Users/mlegls/dev/mmon/concept/.git/index.lock': File exists.` The validated ruling remains in the canonical issue working tree; no successful tracker commit is claimed. Several retries over minutes failed identically. The lock timestamp was 07:12:12 CST, and the last attempt at 07:16:09 still failed. `lsof` showed no open handle at the instant checked; a separate reconciler was active in the canonical checkout. This does not establish a stale lock or its owner.

Owning tool: mlegls-pi tracker vault publication. Workaround: preserve the validated canonical write, report the persistence limit and leave the shared lock untouched; the catalog decision itself was already recorded by supervisor approval. No lock deletion, hook bypass or unrelated canonical commit was attempted.

Open question: should tracker publication coordinate with concurrent Git operations or offer a bounded retry/recovery path after the validated write? Root cause and intended recovery remain to be established.

## Further observation — 2026-10-15

Concept worker `make-lessons-material-centered-implement-2`, session `01a13e70-9aeb-70e5-b79b-f6ac8ad07035`: two successive handoff updates validated and wrote the canonical ticket, then failed to publish because `/Users/mlegls/dev/mmon/concept/.git/index.lock` existed. Worker code/evidence head `ce88f8e` was already committed. `issues.ts text` read the new handoff. `lsof` found no open handle; a process listing subsequently showed another worker's `git worktree remove --force` on the same canonical repository. No stale-lock claim or manual lock removal. Workaround: retained the committed packet and reported pending canonical publication to the parent. Retry after the concurrent operation is the remaining recovery step.
