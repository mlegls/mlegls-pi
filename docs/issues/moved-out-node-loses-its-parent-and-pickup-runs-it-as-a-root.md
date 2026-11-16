---
stage: "ticket"
assignee: "agent"
author: "session:thr_wm7jwxruyk"
priority: 2
---
A node a reconciler moves out of its tree loses its `part-of`, and nothing restores it when the node comes back to an agent. Pickup then sees it as a frontier root and starts a separate reconciler for it, while the original tree stays parked behind it, and neither reconciler knows about the other.

Observed in concept (2026-11-12 → 11-16): `shorten-fresh-practice-and-session-reading-startup` was moved out of `joined-5000-profile-practice-and-map-stay-loading` for authentication shaping. The move-out edit (concept `bb1e1a5d8`) set `assignee: human`, `stage: goal` and dropped `part-of: verify-full-5000-card-profile-opening`, `blocked-by` and `claimed-by`; the reconciler logged "parked verify-full-5000-card-profile-opening behind shorten-fresh-practice-and-session-reading-startup". The shaping session reassigned it to `agent` (`9e396d1a0`, `b822cbe02`) without restoring the parent, so [isMoved](../../lib/reconcile/reconcile.ts)'s "reassigned to an agent (and back under its parent), it's moved back in" never fired. Pickup then started a root reconciler for it, and the joined tree stayed `stuck` four days. The maintainer: "it should still be parented under them" (@thread:thr_4trqx6syym, 2026-11-16).

The move-out instructions in the escalation text ([reconcile.ts](../../lib/reconcile/reconcile.ts), "A move-out you make in the tracker yourself") and the [supervision](../../extensions/supervision/index.ts) `reconcile_resolve` description say nothing about keeping `part-of`, and the vault tracker has no `moveOut` (only [tracker-github-write.ts](../../lib/tracker-github-write.ts) implements it), so each handler edits the file by hand.

Done when a moved-out node keeps its parent link and, once an agent can take it again, it runs in its original tree rather than as a pickup root. Possible shapes: a vault `moveOut` that changes assignee but keeps `part-of`; pickup skipping any node a recorded `s.moved` names (or whose parent is held by a live/stuck reconciler); or the parked reconciler waking when its moved node is reassigned to an agent.
