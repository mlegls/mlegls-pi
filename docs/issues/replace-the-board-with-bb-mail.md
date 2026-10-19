---
stage: "spec"
assignee: "agent"
author: "session:01a15212-f5c4-72f9-98e1-e4e2ab51097c"
---
Replace the board with bb's thread messages and a few convention files, so bb is the only coordination layer.

Decided 2026-10-19 with the maintainer. "bb is working consistently now, so i think we can get rid of the fallback systems in mlegls-pi (zmx, board) where bb can cover it. i think in practice bb mail is used more than the custom board, since it's easy to copy thread references from the gui." zmx already went (`delete-the-zmx-thread-runtime`).

What the board carries today (log `~/.local/share/pi-board/log.jsonl`, since 10-05) and what replaces it:
- Mail (`mail/xxxxxxxx`, ~1,700 messages: reconciler → owner, cross-project supervisors, child-monitor), wake subscriptions, the `thread/<session>` turn-end mirror (~3,200) and `lib/thread/bb-wake.ts`: `bb thread tell <id> --mode queue`, addressed by thread id.
- Worker turn-end reports: workers keep ending with a status word (`agents/_common.md`); the reconciler reads it from bb's turn completion. How it reads completions (polling bb or a plugin event) is the implementer's choice.
- Supervisor constraints (`reconcile_constrain`): bb messages to the worker.
- `role/<repo>/supervisor`: `desk/ROLES.md`.
- Sibling `decision` posts: dropped. 591 posted, 290 delivered to a running sibling across 120 sessions; in 8 sampled deliveries the recipient visibly used one. A conflicting branch is already sent back at rebase. Revisit (a decisions file in `desk/`) if integration-conflict send-backs become noticeably more frequent.

Reconciler workers stay children of the supervisor, since the maintainer folds the tree regularly. Their bb child notices cost $640 in one week in the concept supervisor (@thread:thr_vetzcc74ex; 1,234 wakes, 742 with no tool call). A bb plugin drops them; the reconciler itself tells its owner about exceptions and when a run is fully done.

`desk/`, untracked at the main checkout's root (in `.git/info/exclude`), holds convention files, already named in `agent-prompts/universal.md`: `ATTENTION.md` (what needs the maintainer), `STATUS.md` (reconciler progress, `reconciler-writes-status-md`), `ROLES.md` (standing roles such as `supervisor`, and one line per top-level session on what it's working on). Cleanup happens on write, in code, rather than readers treating old lines as stale.

The board keeps running until the last ticket lands, so nothing in flight breaks; then it, its tools, extension hooks and `role/` scopes are deleted. What `recall` indexes in place of board messages is the implementer's choice.
