---
stage: "ticket"
assignee: "agent:auto-routine"
author: "session:thr_2hd2kf9r28"
priority: 2
part-of: "[[projects/mlegls-pi/issues/outreach-conversations-in-the-bb-tracker]]"
claimed-by: "session:thr_2hd2kf9r28"
---
The maintainer can process outreach replies and follow-ups, browse uncontacted candidates, and review hypothesis tallies inside the [tracker plugin](../../../bb-plugins/tracker/README.md). This is the plugin part of [[projects/mlegls-pi/issues/outreach-conversations-in-the-bb-tracker]], for [[projects/mlegls-pi/stories/manage-outreach-conversations]].

## shape

Implement the parent's "the panel, in `~/dev/bb-plugins/tracker`" shape together in [server.ts](../../../bb-plugins/tracker/server.ts), [model.ts](../../../bb-plugins/tracker/model.ts), [app.tsx](../../../bb-plugins/tracker/app.tsx) and a dedicated `outreach-page.tsx` / `outreach.ts` (mirroring `campaigns-page.tsx` and [attention-service.ts](../../../bb-plugins/tracker/attention-service.ts)):

- Discover projects with `<main checkout>/docs/outreach/` independently of `docs/issues/` (using `mainCheckout` from `tracker.ts`). Watch `docs/outreach/` recursively and publish `OUTREACH_CHANGED` on edits; read via `outreach.ts snapshot --json` (configurable setting `outreachScript`, default `~/.pi/agent/skills/outreach/scripts/outreach.ts`, falling back to a direct local parse if the script is not yet installed so the panel can be driven against fixtures).
- RPCs: `outreach` (snapshot + handled state merged), `outreachPerson` (raw frontmatter + markdown body), `outreachHandled` (`mark` / `unmark` in plugin storage keyed by `(projectId, slug, queueHash)`, automatically pruning stale hashes so a new reply or later due date resurfaces the person).
- Composer mention provider (`~` trigger) for outreach people and hypotheses, plus bidirectional thread links (person detail lists threads mentioning them).
- `navPanel` "Outreach" with `experimental_useBadge` counting unhandled Queue items across projects. Views: **Queue** (with **Mark handled** / `h` and a toggle to view/undo handled items), **Candidates** (`stage: candidate`, grouped/filterable by hypothesis, sorted by `priority`), **Hypotheses** (rollup cards with confirm/kill bar and counts), **All**, **Dropped**. Single **Discuss** action (`d`) for 1 or multi-selected people/candidates or a hypothesis card. Footer showing `lastSync` timestamps/offline notes.

## tasks

Work in a separate Git worktree of `/home/mlegls/dev/bb-plugins`, on a branch from `main`, leaving its unrelated modified `obsidian-at-home` submodule untouched. Commit plugin changes there and declare `{ checkout: /home/mlegls/dev/bb-plugins, commits: [...] }` under the handoff's `commit` key so supervisor @thread:thr_dfgkcug6jp can merge into `/home/mlegls/dev/bb-plugins` main and remove the worktree.

Build the plugin, verify the Queue/Candidates/Hypotheses views, Mark handled + hash-change resurface, and Discuss mention against a disposable project with `docs/outreach/`, and record how to load and restore the plugin deployment in the handoff.
