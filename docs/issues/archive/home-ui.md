---
stage: done
assignee: agent
part-of: "[[projects/mlegls-pi/issues/archive/agentic-setup-reorg]]"
---

Current question: which human cockpit should sit over the delivered libraries and tracker? Current dispatch uses workmux/tmux and the board ([[projects/mlegls-pi/dispatch]]); Orca and Paseo execution adapters are retired, not candidates to restore as a prerequisite. The optional [[projects/mlegls-pi/issues/archive/dsh-port]] is delivered, with its UI proposal in [[projects/mlegls-pi/issues/archive/dsh-supervision-tree-ui]]. The tmux/Obsidian proposal below remains an alternative, not an approved cockpit implementation. Obsidian block launch and persistent tracker views remain separately owned children.

## Earlier proposal

first full-experience target: terminal and harness in tmux, everything else in obsidian. the tracker, campaign gantt ("[[projects/mlegls-pi/issues/archive/campaign-coordinator]]"), frictions, and research live in the vault and are viewed there; the terminal shows sessions and worker panes; the browser is a per-project tab folder (zen) with the usage pages pinned. bb is not mature enough to be home; revisit when its panel plugins and pi threads are stable. cmux may give way back to ghostty, which only touches the terminal half.

the data — board, tracker vault, worktrees — is substrate-independent; views are per-home. the library's substrate seam is `lib/ui` (spawn/focus/list/capture a pane), tmux backend first. workmux stays as a dependency on tmux.

prototype: a cockpit pane reading board and `wm.status` (run tree, waiting handles, needs-input); the vault views are [[projects/mlegls-pi/issues/archive/tracker-obsidian-plugin]].

decisions:
- 2026-09-18: bb is a workspace/UI layer, not a competing harness; its threads are a multiplexer, not a mailbox, so the board stays.
- 2026-09-18: tmux + obsidian is home; bb deferred, not rejected.
- 2026-09-18: operon rejected as the tracker (too heavy, pipeline-only kanban, time-only gantt); frontmatter stays canonical, views are plugins or ours.
- 2026-09-20: the obsidian half is specified in the [[control plane]] project note (four block commands: comment, propose, session, implement; CriticMarkup + shell commands + local rest api for v0). this issue keeps the tmux cockpit half.

decision, 2026-09-30: the cockpit is workmux/tmux + `ab tree` + Obsidian. The Obsidian remainder is agent-owned ([[projects/mlegls-pi/issues/archive/tracker-obsidian-plugin]], [[projects/mlegls-pi/issues/archive/obsidian-implement-sink]]); a DSH cockpit ([[projects/mlegls-pi/issues/archive/dsh-supervision-tree-ui]]) is deferred.

decision, 2026-09-30 (later): Obsidian is a read surface for the tracker ([[projects/mlegls-pi/issues/archive/tracker-obsidian-plugin]] continues), not an interactive cockpit. Capture is one flat "top of mind" note (`~/obsidian/projects/top of mind.md`) processed from a chat harness, with processed items removed; [[projects/mlegls-pi/issues/archive/obsidian-implement-sink]] is dropped, and the outliner plans/fleeting/efforts model behind [[projects/mlegls-pi/issues/archive/reconcile]] is off the main path.

closed, 2026-09-30: the cockpit is workmux/tmux + `ab tree`, Obsidian is a read surface (tracker views delivered), capture is the flat top-of-mind note. A DSH cockpit would be its own new issue ([[projects/mlegls-pi/issues/archive/dsh-supervision-tree-ui]] is a standalone idea).
