---
stage: "ticket"
assignee: "agent"
author: "session:thr_ihbpyrp6s2"
priority: 2
---
A dependent that has its own nested collector never catches up a sibling prerequisite that landed in the shared parent collector, so its reconciler stops as "stuck" forever.

Observed 2026-11-18 in concept: `shorten-compact-capture-and-first-bodies-in-fresh-practice` landed in `tree/joined-5000-profile-practice-and-map-stay-loading` at `52103d344` (2026-11-16 17:22Z). Its waiting sibling `verify-full-5000-card-profile-opening` has collector `tree/verify-full-5000-card-profile-opening` at `0afc596da`, a strict ancestor of the parent. The reconciler finished stuck that minute, and a restart stopped again with "blocked by shorten-compact-… (not satisfied at this destination)". Pickup then skipped the priority-1 child for two days ("ancestor has reconciler state (stuck)"). A hand `git merge --ff-only 52103d344` in the nested collector's worktree unblocked it.

The catch-up merge (`31f43978`) merges missing enclosing-prerequisite commits but deliberately ignores sibling landings; a waits-on edge to a sibling that landed in the parent is the case it misses.

Done when: a nested collector whose waits-on prerequisite has landed in its parent collector is caught up (fast-forward, or merge under lock with conflicts escalated) and the walk continues without a manual merge or restart.
