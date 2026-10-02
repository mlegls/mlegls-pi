---
stage: ticket
assignee: agent
priority: 2
author: "session:95cf9e55-d246-406a-a3bc-f0780b3b2a49"
blocked-by: ["[[projects/concept/issues/declare-a-main-verification-task-and-drop-pre-integrate-owner]]"]
---

A root's landing into the owner's checkout runs the project's slow checks after the landing, outside the integrate lock, instead of before it. From [[projects/concept/issues/streamline-validation-by-value-and-wall-time]]: concept's per-landing `pre-integrate` is under a minute of work; the 30+ minutes are the kept browser batch, which e365f94 runs as `pre-integrate:owner` inside the lock on every owner landing. There are no users; a briefly red main harms nobody (concept's root supervisor, 2026-10-02: staging deploys only by hand or by running the workflow, prod is a separate push).

Done when an owner landing returns after `pre-integrate`, a declared `verify:main` task then runs on that commit in the background, and a red result refuses later owner landings until a green one.

shape:

```text
land(child → into)                         under integrate lock
  if into is the owner's checkout and a red-main marker is set
    refuse: "main red at <sha>: <failing checks>"
  rebase, pre-integrate, retained tests, close, fast-forward   (unchanged)
  if into is the owner's checkout and the project declares verify:main
    enqueue verify(HEAD)                   outside the lock

verify(sha)                                one at a time; a newer sha supersedes a queued one
  pinned worktree at sha (not the owner's checkout: its deployment is the maintainer's interactive one)
  mise run verify:main                     the project owns setup, deployment, seed and what runs
  red   → marker {sha, range landed since last green, output tail}; mail the owner
  green → clear marker; git note on sha
```

- Red blocks owner landings only. Dispatch and landings into collectors continue; workers rebasing onto a red main inherit it, and their per-landing gate may not see it.
- Attribution: several roots can land during one run. First rerun the failing checks at each landed commit in the range (bisect); revert-newest only when that is ambiguous. The result is a repair ticket to whoever landed the breaking commit.
- Delete `pre-integrate:owner` from `declaredGates` (`lib/reconcile/checks.ts`).
- verify runs through the host's heavy-work admission once it exists: [[projects/mlegls-pi/issues/admit-heavy-checks-against-the-host-budget]].

holes:

- Where the marker lives so every reconciler and a manual `integrate` read it (`.git/` of the owner's checkout is the obvious place).
