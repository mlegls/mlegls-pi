---
stage: "ticket"
assignee: "agent"
author: "session:01a15212-f5c4-72f9-98e1-e4e2ab51097c"
part-of: "[[projects/mlegls-pi/issues/replace-the-board-with-bb-mail]]"
---
Reconciler workers' bb child-completion notices cost the supervisor no model call and leave it idle: pi answers each notice turn locally, and the pairs are kept out of the model's context.

Decided 2026-10-19 with the maintainer (option b). Two cleaner mechanisms are blocked upstream in bb 0.46.1, the latest release:
- bb's plugin `message.dispatch` hook never runs on ready-parent system messages ([[projects/mlegls-pi/issues/installed-bb-bypasses-dispatch-hook-for-parent-system-notices]]).
- A pi `input` handler returning `handled` suppresses the model call, but bb's Pi provider never settles the turn, so the thread stays `active` ([[projects/mlegls-pi/issues/bb-pi-handled-input-leaves-thread-active]], upstream get-bb/bb#3792, confirmed-repro). Evidence: commit `1308c295` on `drop-reconciler-worker-notices-in-a-bb-plugin-implement-1`, whose ownership recognition and pass-through checks held and can be reused.

Shape: let the notice turn run normally, so bb sees an ordinary start and settle. When the input starts `[bb system]` and reports `@thread:<child> completed:` for a child a running reconciler owns, route the turn (pi's virtual-model `route`, as `extensions/stances` does, or another pi mechanism) to a local stand-in that replies with a fixed short text, calls no provider and no tools. A `context` hook removes these notice/reply pairs from every later request, so they never reach a real model. Everything else proceeds unchanged. Workers stay children of the supervisor.

Done:
- Live under bb 0.46.1: an owned worker's notice ends with the supervisor idle, no error surfaced, and no provider request; the child keeps its status and parent link in the tree.
- Live: an ordinary child's notice and the reconciler's own tell still reach the real model.
- The next real model request after a dropped notice carries no trace of it.
- `bb/reconciler-notices` is gone from the branch. When bb#3792 is fixed, the stand-in can give way to returning `handled`; note that in the code.
