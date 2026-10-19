---
stage: "done"
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

## Result

done

```yaml
commit: fb93fc5d
stories:
  - story: Owned completion settles idle without provider call or error
    outcome: held
  - story: Child status and parent link remain intact
    outcome: held
  - story: Ordinary completion and reconciler-style tell reach real model
    outcome: held
  - story: Next real request excludes owned notice and local reply
    outcome: held
  - story: Plugin removal and future-handled code comment
    outcome: held
evidence:
  path: docs/attachments/drop-reconciler-worker-notices-in-a-bb-plugin/drive-b.md
  visual: false
  shots: []
tests: []
fixed:
  - b71ea770 stops the input handler swapping the model when a notice is queued into a running turn
caveats:
  - The mid-turn guard (`event.streamingBehavior`) was not re-driven live. The driven path, an idle supervisor, is unchanged because `streamingBehavior` is undefined when idle. It was checked against pi's `agent-session.js` source, where the input hook also fires for steer and follow-up messages while streaming. Without the guard such a notice would have moved the running turn onto the stand-in model. With it, that notice goes to the real model.
  - Stand-in cost is zero. The local turn makes no provider call and no tool call, and it records zero usage. It does add one `bb-notice-model` session entry and two model changes per owned notice.
  - The `bb/reconciler-notices` plugin is not on the base or the branch. I checked this in git, and the only remaining match is the file name `extensions/bb/reconciler-notices.ts`. The stand-in's code comment names bb#3792 and says to switch to `handled` once it is fixed.
  - The driver filed no frictions, so nothing in the tracker needed settling.
```

Evidence: [docs/attachments/drop-reconciler-worker-notices-in-a-bb-plugin/drive-b.md](docs/attachments/drop-reconciler-worker-notices-in-a-bb-plugin/drive-b.md)
