---
stage: "idea"
assignee: "human"
priority: 3
author: "session:01a20657-0e8d-726c-98b9-a4f79a5a23fc"
---
Found in the 2026-11-23 audit of the supervision/issue orchestration system (@thread:thr_3pkhxrd57p).

> `docs/attachments/` is already **50 MB across 723 files** (107 `.json`, 88 `.txt`, 39 `.log`, 87 `.ts`) checked out into *every* worktree despite the doc saying "don't commit raw output and prune after close." Even `drive: none` tickets are forced ([reconcile.ts](../../lib/reconcile/reconcile.ts#L744)) to commit a `docs/attachments/<ticket>/index.md` and full `stories`/`evidence` YAML.
> **Cut**: Stop forcing packets on `drive: none` (and trivial non-visual tickets); store screenshots/traces outside git HEAD (e.g. BB thread storage or an untracked/external artifact dir) instead of bloating every worktree and running `git log --all` archaeology in `evidence.ts`.

Code: [evidence.ts](../../lib/reconcile/evidence.ts), [docs/verification-evidence.md](../../docs/verification-evidence.md). Two decisions: packets for `drive: none`/trivial tickets, and where evidence lives.
