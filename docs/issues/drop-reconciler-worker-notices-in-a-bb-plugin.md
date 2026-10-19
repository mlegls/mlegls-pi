---
stage: "ticket"
assignee: "agent"
author: "session:01a15212-f5c4-72f9-98e1-e4e2ab51097c"
part-of: "[[projects/mlegls-pi/issues/replace-the-board-with-bb-mail]]"
blocked-by:
  - "[[projects/mlegls-pi/issues/bb-pi-handled-input-leaves-thread-active]]"
---
A pi `input` handler in `extensions/bb` drops bb's child-completion notices about reconciler-owned workers, so the supervisor spends no model turn on those notices and wakes only for exceptions and a run's completion.

Decision 2026-10-19: follow the supervisor's maintainer-approved pi-level interception constraint. Installed bb 0.46.1 is the latest release; its ready-parent system-message path bypasses `message.dispatch`. Do not wait for SDK 0.6.54, upgrade/restart the shared desktop runtime, or retain the `bb/reconciler-notices` plugin. The slug is retained for execution continuity; the plugin implementation is superseded, not accepted.

Shape: when a pi input starts `[bb system]` and reports `@thread:<child> completed:`, check that a running reconciler owns that child; only then return `{ action: "handled" }`. Everything else continues. Ownership must be established, not inferred from any arbitrary child alone. Recognition details are the implementer's choice. Keep workers children of the supervisor.

Done:
- The pi handler suppresses reconciler-worker completion notices before a model invocation. Other inputs proceed, including notices for independently spawned children and the reconciler's own tells to its owner.
- Checked live under the installed bb runtime: a dropped notice leaves the supervisor idle with no model invocation, stuck turn, or surfaced error; the child still shows its completion status and supervisor parent link in the tree. A transient bb input/turn lifecycle event is not itself a failure if it ends idle without invoking the model.
- Checked live: an ordinary child's completion notice and the reconciler's own tell still reach the supervisor normally.
- Delete `bb/reconciler-notices` from the branch; preserve [[projects/mlegls-pi/issues/installed-bb-bypasses-dispatch-hook-for-parent-system-notices]] as the upstream hook-coverage request.

Stories and required handoff claims: report owned-worker suppression, ordinary-child pass-through, reconciler-tell pass-through, retained parent/status, and idle/error-free lifecycle separately, with live thread/event identifiers and model-invocation evidence. Update the evidence packet for the pi implementation. The earlier plugin probe's live suppression failed on bb 0.46.1; its passing hook-boundary checks are not held product stories and do not replace these checks.

## Implementation blocked (2026-10-19)

Pi interception is committed on the worker branch (commit replacing the plugin, with `extensions/bb/reconciler-notices.ts` and `docs/attachments/drop-reconciler-worker-notices-in-a-bb-plugin/index.md`). The owned-child notice is consumed before any model invocation, but installed BB leaves its pending submission active indefinitely because Pi's `handled` disposition produces no run/settlement event. The 15-second idle wait timed out. Ordinary-child notices and the direct tell transport still reach the model, and child status/parentage stays intact. Manual stop was used only to recover the disposable fixture; it is not acceptance of the no-stuck-turn contract.

Blocked by the observed interoperability gap recorded outside this execution tree: [[projects/mlegls-pi/issues/bb-pi-handled-input-leaves-thread-active]]. The original hook-coverage issue remains open. Requires BB provider handling of Pi's handled disposition, or re-specifying an authorized alternative; no shared runtime was upgraded/restarted, and no fake lifecycle events were emitted. Fixture project/threads/processes were stopped or removed. Existing affected tests (3 total) and typecheck passed. Do not close or land this as a completed workaround on the current runtime.

## Refinement gate (2026-10-19)

No executable subdivision can satisfy the current contract on the installed runtime. The Pi implementation and live evidence are preserved at `1308c2953afe176ee81c4ec218f5d58e9ddf749a` on `drop-reconciler-worker-notices-in-a-bb-plugin-implement-1`; this refinement checkout does not contain that implementation. Its evidence packet is `docs/attachments/drop-reconciler-worker-notices-in-a-bb-plugin/index.md` at that commit. The failure is in BB's Pi-provider settlement, not missing ownership recognition or a larger mlegls-pi implementation.

Verified against the active Pi 1.2.0 installation: `docs/rpc.md` (Run lifecycle) and `docs/rpc-commands.md` (prompt) explicitly say `disposition: handled` starts no run and clients must not wait for `agent_settled`. Installed BB's `provider-pi/dist/host.js` forwards `agent_settled` at lines 505–515 and contains no disposition handling. The existing live probe's parent `thr_676spydr7f` remained active after child-completed request seq 21 with no model invocation; manual stop is not settlement acceptance.

The required prerequisite is [[projects/mlegls-pi/issues/bb-pi-handled-input-leaves-thread-active]], now recorded in `blocked-by`. It remains outside this execution tree, assigned to the human owner. No children or shared interface stubs are created: repairing get-bb/bb without an owned source checkout/deployment, patching or restarting the shared app, fabricating lifecycle events, and changing the mandated interception mechanism are not authorized by this contract.

Recommendation: obtain maintainer authorization and an owned target for the BB Pi-provider settlement repair, or an explicitly revised interception contract. Do not wait for a newer BB release, relax idle/no-model acceptance, or land the blocked implementation as complete. Once the prerequisite is resolved, resume this existing ticket from the preserved commit and re-drive all five required claims on the authorized runtime; retain the original hook-coverage issue separately.

