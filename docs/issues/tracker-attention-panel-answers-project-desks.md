---
stage: "done"
assignee: "agent:auto-routine"
author: "session:01a1cdc8-f756-70d2-9515-c6c42afeff63"
priority: 2
part-of: "[[projects/mlegls-pi/issues/attention-inbox-in-the-bb-tracker]]"
---
The maintainer can read and answer all projects' desk attention items from the tracker plugin, including supplying credentials to the requested dotenv files. This is the plugin part of [[projects/mlegls-pi/issues/attention-inbox-in-the-bb-tracker]], for [[projects/mlegls-pi/stories/answer-what-agents-ask-of-me]].

## shape

Implement the parent's “the panel, in `~/dev/bb-plugins/tracker`” shape together: [server.ts](../../../bb-plugins/tracker/server.ts) attention/reply RPCs, desk watching, answered records, dotenv writes and grouped queued messages; [app.tsx](../../../bb-plugins/tracker/app.tsx) Attention navigation/badge and the project-grouped Markdown items, recommendation, quoting, per-item reply drafts, ephemeral password inputs, batch Send and collapsed answered state. The parent fixes the file format, reply payload and value lifetime. Keep backend and UI in this one session so their RPC interface is owned together.

Attention covers every project returned by `bb.sdk.projects.list()`, including ones without a vault tracker. The existing `projects()` helper filters to projects with `docs/issues`; its filtered set is insufficient here. Resolve the main checkout for the desk independently of vault presence, and watch newly created desks as well as existing ones.

## tasks

Work in a separate Git worktree of `/home/mlegls/dev/bb-plugins`, on a branch from `main`. Leave its unrelated modified `obsidian-at-home` submodule alone. Commit plugin changes there and return the branch, worktree path and commit IDs, declaring the foreign repository as `{ checkout: /home/mlegls/dev/bb-plugins, commits: [...] }` under the handoff's `commit` key. The supervisor @thread:thr_dfgkcug6jp merges that branch into `/home/mlegls/dev/bb-plugins` main when the completion hold fires; the ticket stays open until that ancestry is present. Remove the foreign worktree after merge, with cleanup ownership retained by the supervisor if the worker has already retired. This landing arrangement was approved by that supervisor on 2026-11-12.

Build the plugin and prepare a runnable live deployment plus disposable-project setup for the parent's combined first use. Record how to load this branch's plugin and restore the previous deployment. The parent owns the complete desk-helper → panel → owner-message → removal drive after both children land; this child should still try its own changed behavior and hand off the setup.

## Result

done. The five stories hold on the final head. I found no contract defect and made four small repairs. The live tracker plugin is rebuilt and reloaded with them.

I read the plugin diff against the parent's contract and checked the dotenv write by hand. After rebuilding, I reset the disposable fixture and ran `rm -rf desk && mkdir desk` with the file restored. The `attention` RPC then returned the disposable project's two items. I didn't re-drive the UI change in a browser, and the project-read-error path was not exercised. `tsc --noEmit` passes.

Repairs in `bb19629`:
- **Recreated desk:** the watcher stayed on the deleted directory when `desk/` was removed and recreated between two reads, so only the 15 s poll saw changes. The root watcher now closes and reopens it.
- **Draft loss:** the Attention page pruned stored drafts and password inputs for items missing from the response, including those of a project whose read failed. It now skips pruning while any project reports an error.
- **Main-checkout lookup:** the plugin already had three copies of the git-common-dir lookup, and `attention.ts` added a fourth. `tracker.ts` now exports `mainCheckout`, and `trackerRoot` and the attention service both use it.
- **`model.ts` comment:** `ATTENTION_CHANGED` had been inserted under `CHANGED`'s doc comment; each constant has its own again.

I appended a review section to the driver's packet and committed it as `8abf0ec6`. The driver's screenshots and log are untouched.

No worker-filed tracker friction needed settling, and I filed nothing new.

```yaml
commit:
  - checkout: /home/mlegls/dev/bb-plugins
    branch: attention-panel
    worktree: /home/mlegls/dev/bb-plugins__worktrees/attention-panel
    commits: [064e30e, 8585df3, d4fc0a3, caa121d, bb19629]
  - checkout: mlegls-pi (this worktree)
    commits: [87c87593, 8abf0ec6]
stories:
  - story: Read attention across projects, including a project without a vault tracker
    outcome: held
  - story: Use recommendations, passage quoting, independent drafts and masked credential input
    outcome: held
  - story: Batch Send delivers grouped owner replies and writes the requested dotenv value
    outcome: held
  - story: Answered items collapse and unanswered badge decreases
    outcome: held
  - story: Removed and recreated desks update the panel without reload
    outcome: held
evidence:
  path: docs/attachments/tracker-attention-panel-answers-project-desks/index.md
  visual: true
  shots:
    - docs/attachments/tracker-attention-panel-answers-project-desks/01-drafts.jpg
    - docs/attachments/tracker-attention-panel-answers-project-desks/02-answered.jpg
tests: []
filed: []
fixed:
  - "bb19629: stale desk watcher after desk recreation; draft pruning on a project read error; mainCheckout consolidation; model.ts comment"
redrive: false
caveats:
  - "The two screenshots predate the repairs. They show state the repairs don't touch, but I didn't recapture them."
  - "Not changed: if the owner send fails after the dotenv write succeeds, the error shows while the file already holds the value, and the cleared password input has to be retyped on retry."
  - "Not changed: remote-only projects refresh by 15 s poll, not a watcher. The poll also reads every project's desk and owner threads every 15 s while the plugin runs."
  - "The plugin commits include the SDK migration (064e30e, 8585df3), which is needed to build on the current SDK."
  - "Live deployment: the tracker plugin runs from /home/mlegls/dev/bb-plugins__worktrees/attention-panel/tracker and is rebuilt at bb19629. After merge, run `bb plugin install /home/mlegls/dev/bb-plugins/tracker --yes` before removing that worktree. Restore with `bb plugin install /Users/mlegls/dev/bb-plugins/tracker --yes`. Details are in tracker/docs/attention-first-use.md."
  - "The disposable project proj_846b5mt9ew (/home/mlegls/dev/attention-panel-disposable, owner thr_m6p2dzhyip) is left in place with two seeded unanswered items for the parent's combined drive."
  - "I started no processes."
```

Evidence: [docs/attachments/tracker-attention-panel-answers-project-desks/index.md](../attachments/tracker-attention-panel-answers-project-desks/index.md)
