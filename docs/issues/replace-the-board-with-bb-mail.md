---
stage: "done"
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

Reconciler workers stay children of the supervisor, since the maintainer folds the tree regularly. Their bb child notices cost $640 in one week in the concept supervisor (@thread:thr_vetzcc74ex; 1,234 wakes, 742 with no tool call). A pi `input` handler in `extensions/bb` drops them before model invocation; the reconciler itself tells its owner about exceptions and when a run is fully done. Decision 2026-10-19: the maintainer approved pi-level interception because current bb 0.46.1 bypasses the plugin dispatch hook for ready-parent system notices. Do not wait for a newer runtime or restart/upgrade the shared server. The child ticket's historical plugin slug is retained, but its plugin approach is superseded. Live acceptance requires idle, error-free handling with no model invocation, retained child status/parent link, ordinary-child notice pass-through, and reconciler-tell pass-through; the unsuccessful plugin probe is not acceptance.

`desk/`, untracked at the main checkout's root (in `.git/info/exclude`), holds convention files, already named in `agent-prompts/universal.md`: `ATTENTION.md` (what needs the maintainer), `STATUS.md` (reconciler progress, `reconciler-writes-status-md`), `ROLES.md` (standing roles such as `supervisor`, and one line per top-level session on what it's working on). Cleanup happens on write, in code, rather than readers treating old lines as stale.

The board keeps running until the last ticket lands, so nothing in flight breaks; then it, its tools, extension hooks and `role/` scopes are deleted. What `recall` indexes in place of board messages is the implementer's choice.

## Result

done

The joined tracker change holds on the final head. I made one small repair and found nothing structural to consolidate.

- **Repair (`9104e463`):** the removed `roleHolders` swallowed errors, but the new `roleHolder` in `bb/tracker/server.ts` didn't. A failing `desk/ROLES.md` lookup would have failed the whole supervisors list. It now logs a warning and treats that as no role holder. Supervising a role target then reports "No live supervisor in desk/ROLES.md".
- **Checks on this head:**
  - The driver's encounter was re-run and still exits 0 with the same outputs.
  - The affected test directories pass (42 tests).
  - The tracker `tsc` and `bb plugin types --check` pass.
  - `mise run test:affected` doesn't exist in this repo, so I ran those directories directly.
- **Structural pass:** no leftover board or `role/` references in `bb/tracker`, and the role lookup already reuses `roleThread` from `lib/desk.ts`.
- **Evidence:** I appended a Review section to the committed index (`21038c68`).

```yaml
commit: 21038c68
stories:
  - story: Tracker discovers desk supervisor and queues supervision
    outcome: held
  - story: Unavailable or absent supervisor is excluded
    outcome: held
evidence:
  path: docs/attachments/replace-the-board-with-bb-mail/index.md
  visual: false
  shots: []
tests:
  - lib/reconcile
  - lib/thread
  - extensions/bb
  - extensions/supervision
fixed:
  - "9104e463: failing desk role lookup warns instead of failing the supervisors list"
changes: []
caveats:
  - "Isolated SDK fixture: no real messages sent, no live bb UI run. The encounter costs about 8 s and an `npm ci` of the tracker's dependencies."
  - "The four test directories take about 187 s."
```

Evidence: [docs/attachments/replace-the-board-with-bb-mail/index.md](docs/attachments/replace-the-board-with-bb-mail/index.md)
