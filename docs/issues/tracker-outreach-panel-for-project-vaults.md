---
stage: "done"
assignee: "agent:auto-routine"
author: "session:thr_2hd2kf9r28"
priority: 2
part-of: "[[projects/mlegls-pi/issues/outreach-conversations-in-the-bb-tracker]]"
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

## Result

done — All eight stories held. The repaired Discuss flow carried both selected people and their shared hypothesis through the draft, sent message, and thread menu.

```yaml
commit:
  checkout: "/home/mlegls/dev/bb-plugins"
  commits:
    - "92e3467863da32de043c95f611606222d4463723"
    - "c20a38b1a42e4a90ee0565d6b2d697cb530d7132"
    - "c4e1c1b23ed27053d455a158cf987435a741ead6"
    - "f941e286c2c68e8f6f2413002808ee9b13abed2e"
    - "fb98bae385b6021a36aa33b6c404d4109d2235f6"
setup:
  evidenceCommit: "fe42bb71"
  load: 'From the merged tracker directory: bb plugin build . && bb plugin install "$PWD" --yes'
  restore: 'bb plugin install /Users/mlegls/dev/bb-plugins/tracker --yes'
stories:
  - {story: "Process replies in Queue and see new replies resurface without refreshing", outcome: held}
  - {story: "Browse priority-ordered candidates grouped and filterable by hypothesis", outcome: held}
  - {story: "Review hypothesis tallies and start a hypothesis-only draft", outcome: held}
  - {story: "Discuss selected people with their shared hypothesis attached", outcome: held}
  - {story: "Navigate between a person record and its discussion thread", outcome: held}
  - {story: "Browse All and Dropped and see sync status for an unsynced vault", outcome: held}
  - {story: "Resurface a handled follow-up when its due date changes", outcome: held}
  - {story: "Find people and hypotheses via the manual ~ picker", outcome: held}
evidence:
  path: docs/attachments/tracker-outreach-panel-for-project-vaults/index.md
  visual: true
  shots:
    - docs/attachments/tracker-outreach-panel-for-project-vaults/queue.jpg
    - docs/attachments/tracker-outreach-panel-for-project-vaults/resurfaced.jpg
    - docs/attachments/tracker-outreach-panel-for-project-vaults/candidates.jpg
    - docs/attachments/tracker-outreach-panel-for-project-vaults/discuss.jpg
    - docs/attachments/tracker-outreach-panel-for-project-vaults/hypotheses.jpg
fixed:
  - "Discuss attaches each distinct linked hypothesis once and counts mixed targets as records."
tests: []
filed:
  - "[[projects/mlegls-pi/issues/outreach-discuss-omits-shared-hypothesis]] — verified; close after plugin landing."
  - "https://github.com/get-bb/bb/issues/7534#issuecomment-7062553249 — added the driver's occurrence and closed the local duplicate."
caveats:
  - "Restored the prior tracker deployment and removed the disposable project. The review desktop session closed, but both tab-cleanup attempts returned stale generation; its owned tab may remain."
```

Evidence: [docs/attachments/tracker-outreach-panel-for-project-vaults/index.md](../attachments/tracker-outreach-panel-for-project-vaults/index.md)
