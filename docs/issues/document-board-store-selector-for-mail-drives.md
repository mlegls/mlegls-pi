---
stage: idea
assignee: agent
author: session:01a0f0a6-087a-779d-aae2-51c259287f48
---

Still applies after `ab mail` was deleted (2026-10-01): the `mail` and `board_*` tools and `lib/board.ts` write `$XDG_DATA_HOME/pi-board/records.db` (PI_BOARD_DIR overrides the directory), and nothing names that as the isolation selector.

While driving [[projects/mlegls-pi/issues/archive/address-the-waiting-child-in-exception-mail]], the setup handoff promised isolated temporary board/state but gave no board store selector. `AB_STATE` and `AB_SESSION_STATE` pointed at a new temporary directory; `HOME` was changed for a second attempt. In both cases `bun ab/main.ts mail --stats` still counted 1147 preexisting posts, and the subsequent synthetic `ticket/demo/nonexistent-review-1` and `ticket/drive/unsubscribed` messages landed in the shared board store. No live reader was intended or identified for those topics. Neither `ab mail --help` nor the setup handoff said that the mail board follows `XDG_DATA_HOME`, not `AB_STATE` or `HOME` alone.

Workaround: set `XDG_DATA_HOME=<temp>/data` for every Pi and CLI process, and confirm `ab mail --stats` starts empty before sending. This produced a separate `<temp>/data/pi-board/log.jsonl`; `XDG_STATE_HOME` and `AB_STATE` were isolated as well. Document the selector and a safe preflight in the CLI help or supervision setup handoff, so first-use smoke checks do not write into shared board history. The observation concerns documentation/setup discoverability, not an assertion that the board failed to honor its configured path.

In the [joined CLI drive](../attachments/small-ab-cli-fixes/drive.md), `ab lib board topics` during CLI discovery exposed the shared store because AB_STATE is not the board selector. No synthetic mail was sent there. The existing XDG_DATA_HOME workaround made `mail --stats` empty before every actual send; all five posts remained in the isolated board.
