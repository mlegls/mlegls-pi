---
stage: "ticket"
assignee: "agent"
priority: 2
author: "session:thr_chd6gnjgbs"
---
goal: the reconciler doesn't close an issue whose cited evidence isn't on the target. Maintainer, 2026-11-08 (@thread:thr_chd6gnjgbs).

Observed in concept: done issues cited packets that existed only on worker branches (drive, recovery or earlier implement branches), never landed: session-closing-summary, seed-mission-quiet, staging-session-final-frame-left-text-under-rail, make-staged-decline-send-requirements-explicit, check-that-a-first-map-appears-within-minutes and others, restored by hand on concept main (55065ebf4, 97f493426, c317fe590). `evidencePacket` in [checks.ts](../../lib/reconcile/checks.ts) checks the handoff's index and shots at the worker's HEAD, but nothing checks the tracker body's attachment links, and nothing checks again at the target.

## shape

In `closeAtTarget` ([completion.ts](../../lib/reconcile/completion.ts)), before `tracker.close`, resolve against the target ref (`git cat-file -e <target>:<path>`): the result's evidence path and shots, and every relative link and `[[projects/<this>/attachments/…]]` wikilink under `docs/attachments/` in the issue's tracker body. A missing one keeps the node unclosed and raises an exception naming each missing path and the branch commits that have it (`git log --all -1 -- <path>`), so the handler can carry them over or rewrite the link. Links that already resolved before this landing aren't the node's to fix: only paths the node's own branches added or the body gained during the node's run count, so another node's stale links never block a close.

Done when a reconciler test lands a node whose body links a packet committed only on its drive branch and sees the close held with that path named, and one whose links all resolve on the target closes as before.
