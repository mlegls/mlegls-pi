---
name: supervise
description: "Use to carry a campaign through execution and verification while keeping the user oriented."
argument-hint: "an agreed issue subtree"
---

At entry, refresh semantic tracker lint for the requested scope: `bun ~/.pi/agent/skills/tracker/scripts/issues.ts lint [slug]` from the project. Reconcile triage signals before selecting work; lint errors mean unavailable evidence, not a clean tracker. This is advisory, not a dispatch gate. Run once per orientation/campaign, not before each child dispatch.

Be the supervisor for this scope. Delegate substantial work; lightly triage tickets, coordinate implementation and verification Gantt-style, and keep me in touch with overall progress, what's established and what's next. The campaign is the existing parent issue.

Implementation workers own changes, existing regression runs and runnable setup; fresh verifiers own acceptance and encounter-grounded replay checks. Missing coverage alone is not work to commission. Keep systematic audits separately scoped.

1. Orient with `autoread.run` as needed: destination, dependencies, acceptance/stories, current evidence, claims and live execution. Recover the native worker handles and reports (`multi-agent`).
2. Dispatch ready streams as capacity and dependencies permit: `route.prepare` → `dispatch.dispatch`. Use `compile` for assignment preparation and `orchestrate` for large bounded units. Research is dispatchable when its question and completion criterion are settled; exploratory work belongs to its shaping session.
3. Surface what needs me, ranked by what it unblocks, as bounded `shape` assignments for separate sessions. Triage within recorded decisions; consequentially wrong or incomplete tickets go back for shaping. Incorporate updated tickets and completion reports, continuing independent branches meanwhile.
4. Integrate changes and dispatch a fresh `verify-story` worker with runnable setup and affected stories for first use, guide/recording updates and reviewed replay. Batch related changes into a coherent journey. Reconcile issues and dependencies against the evidence. Route in-contract repairs to workers; changed contracts to shaping. Explicitly dispose of findings. Landed is not yet verified; close against acceptance.
5. Launch the next ready wave. Keep the parent current and report progress toward its destination, remaining work, live streams, and decisions needed. Finish when the destination is met; if everything is blocked, report what resumes it.

Keep this session across waves with OM and compaction. Tickets/docs hold shared truth; session/OM hold working context; retained native receipts identify live workers and pending integration. At checkpoints make a replacement recoverable without requiring one. Use `route.continuation` for worker exceptions and context checkpoints. Fresh verifiers provide independent judgment; the supervisor retains continuity.

For tracker work, pass each issue’s own `assignee` (including absence) to `route.prepare`, then carry `issue` and `assignee` into dispatch. Re-read child assignments when decomposing; explicit human/session ownership requires its owner.
