---
stage: ticket
assignee: agent:technical
author: session:01a0f6e1-7ec3-7620-b7fd-edc63c2b3d94
part-of: "[[projects/mlegls-pi/issues/thread-core-and-workers-on-zmx]]"
blocked-by: ["[[projects/mlegls-pi/issues/thread-registry-and-zmx-launch]]"]
priority: 2
---

Session mode: hacking. Preserve [[projects/mlegls-pi/stories/work-in-threads]]. The decisions in [[projects/mlegls-pi/issues/thread-registry-on-zmx]] and the committed `lib/thread/index.ts` seam are the contract; the seam is currently throwing stubs, not a second backend. Source evidence: [zmx/pi launch constraints](../attachments/thread-core-and-workers-on-zmx/source-contract.md).

Implement `lib/thread/lifecycle.ts` and private lifecycle helpers. Do not change `lib/dispatch.ts`, `lib/wm.ts`, the CLI, UI or in-pi commands. This ticket implements the already-defined archive/abandon and the single-thread raw integration primitive; user-facing `ab thread merge` lifetime is separately blocked on [[projects/mlegls-pi/issues/thread-merge-command-lifetime]].

## Edits

- Extract/mirror plain-git integration from `lib/dispatch.ts:integrate` into `integrateThread`. Destination is the worker/thread branch's `ab-parent`, resolved to its checkout using `git worktree list --porcelain`; not the caller's HEAD, spawn-parent record or base SHA. A missing/deleted parent is an explicit failure, never silently a different target. Guests return undefined and merge nothing.
- Preserve clean-worker refusal, prepare hook before touching the destination and its clean-tree check, default rebase/update then ff-only, explicit merge mode's no-ff commit, and the existing merge-bearing-child update logic (contains base → no update; merge commits → merge base into child; otherwise rebase). Capture conflict file names before abort, leave failed integration unapplied, and throw the published `ThreadMergeConflict` with that node/branch/parent/files. Raw integrate performs neither retirement nor conflict messaging: supervision already owns that retry.
- `archiveThread` takes the active spawn subtree in post-order. For each node: archive children, integrate its branch into its ab-parent, then retire it. Persist archived only after that node's cleanup; partial completion remains observable and retry skips already-archived descendants. Branch merge lineage is separate from spawn lineage.
- On archive conflict, keep that node and unvisited ancestors/resources active. Persist its `blocked` marker, send only that thread's canonical agent “rebase onto <parent> and resolve”, with the files and instruction to report done/blocked. Capture a board cursor before sending. Workers report on run/handle; ordinary canonical threads on thread/id. Match fresh terminal reports from that agent (including current-session changes), not an old done or the parent's report. A fresh done retries this node and continues the same walk; blocked stops here and returns the marker in `ThreadCleanup`. Checkpoint/needs-input/no-status are not successful resolution. Raw send needs a real CR for an intended TUI submission, or use a waking board mail; do not change the literal transport.
- `abandonThread` is the same post-order retirement with no merges. Explicit abandon may discard owned branches; `keepBranch: true` keeps every owned branch for its caller (retire's patch-equivalence policy is in the consumer). Archive deletes only successfully integrated owned branches; report branch deletion/retention and killed pids.
- Kill all owned zmx terminals by labels/names, mark known retiring live pids first using `markRetired`, stop the canonical pi (including one open outside zmx), and stop leftover processes rooted in an owned worktree using `lib/dispatch.ts:killLeftovers`'s lsof-cwd precedent. Do so before worktree removal, without the old trash-path assumption. Exclude the cleanup controller, unrelated checkouts and shared guest cwd processes. A guest closes its own terminals/pi but never removes its cwd/worktree, kills unrelated cwd peers, merges or deletes somebody else's branch. Record archive state so the agent loop cannot restart retired pi.

## First use / acceptance

Temporary owned git repository, isolated XDG state/board, normal agent threads over zmx. Start a parent and child on separate owned branches, deliberately conflict one tracked file between them. Archive the parent: the child alone receives the conflict, no parent branch is merged/removed early, and a fresh child done causes child → parent → parent's ab-parent integration and all fixture resources disappear. Repeat with child blocked: that child and ancestors remain active, already-retired nodes stay retired, the marker is returned/persisted, and retry after resolution continues safely.

Also abandon a nested tree with keepBranch true; branches survive and no changes merge. Archive/abandon a guest with an unrelated process in the same checkout: only the thread's own resources close. Supply fixture ids, conflict file and runnable invocation to the driver. Run relevant existing git/live regressions and root typecheck (plugin setup workaround linked above). The parent join will re-drive the two-level conflict through the actual CLI after consumers land.
