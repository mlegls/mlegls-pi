---
stage: "ticket"
assignee: "agent"
author: "session:01a15212-f5c4-72f9-98e1-e4e2ab51097c"
part-of: "[[projects/mlegls-pi/issues/replace-the-board-with-bb-mail]]"
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
