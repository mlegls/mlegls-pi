---
stage: idea
author: session:e165cc90-270f-46af-9d42-b4c4fdff7d9e
priority: 2
---

The reconciler merges the collector into a replacement before setup, then asks the replacement to resolve conflicts as its first step. A source conflict can prevent setup from launching that agent. Owning tool/repository: mlegls-pi reconciler, `lib/reconcile/reconcile.ts:startPhase` and `lib/thread/agent-runner.ts:pendingSetup`. This follows [[projects/mlegls-pi/issues/replacement-drive-misses-recorded-offline-audit-scope]], whose conflict recovery assumes the replacement can start.

Observed 2026-10-09 under Concept's `review-every-node-on-a-schedule`, child `review-through-a-few-multi-node-free-response-problems`: original implementer hit `WebSocket closed 1000`; replacements c, d and e exited before an agent turn. Reconciler log labels these as dead workers. Thread e is `a24ec88d-4c00-4fca-b190-0e70a071f5c0`; its session JSONL contains only the session header. `bun lib/wm.ts capture review-through-a-few-multi-node-free-response-problems-implement-e --run review-every-node-on-a-schedule` shows `Worker setup failed: 1`.

The setup log `~/.local/state/ab-threads/a24ec88d-4c00-4fca-b190-0e70a071f5c0.setup.log` locates the failure: Convex push reports `Unexpected "<<"` at `packages/core/src/theory/default/skills/sources.ts:14`. The failed worktree has a pending merge of collector `100c6bc0`; only the generated Skill sources are unmerged, and the Lesson Skill Markdown merged cleanly. `startPhase` explicitly leaves refresh conflicts for the successor, but its deployment setup runs first. This is a startup ordering failure, not evidence that the implementation approach failed.

Tried: inspect worker capture, setup log, session header and pending merge; repeated automatic relaunch already reproduced the startup failure. Proposed workaround: before retrying, regenerate Skill sources in the failed worktree with `bun run build:skills`, stage that file and commit the pending merge (preserving both histories). The handler was restricted to tracker changes, so this workaround was not executed and setup recovery is not yet observed.

Recommendation: provide a conflict-recovery launch path that does not require a successful deployment push; report setup failures with their cause rather than cycling through worker-death retries. Do not discard the predecessor's committed implementation or abort the collector merge merely to make setup pass.
