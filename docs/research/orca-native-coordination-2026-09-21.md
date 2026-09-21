# Native Orca coordination — 2026-09-21

Baseline `90f2af3`; macOS, Pi 0.84.4, Orca 1.4.206. Product surface: imported TypeScript API and real Pi terminals in the running Orca app. No `docs/stories/` exists; `docs/orca.md` and `docs/dispatch.md` are the acceptance guides.

## Observed

- Created a disposable coordinator terminal and bound Run `run_fb407596bbdb` using its actual handle. Calling `worker-start` without a bound coordinator was refused (`consumer_fenced`); no fallback scheduler or fabricated identity was used.
- Native `worker-start --agent pi` accepted a self-contained no-edit probe. Pi consumed the injected lifecycle preamble and sent `worker_done` with the authoritative Task/Dispatch IDs. Native release returned `released / closed_agent_terminal` after settlement.
- Two consuming checks from independent CLI invocations returned the same unacknowledged delivery ID, with `replayed: true`. Explicit acknowledgment cleared it. This establishes replay across CLI processes, not recovery across an Orca app restart.
- Native Pi model selection was refused with `invalid_argument`. `orca.startPi` successfully launched the selected DeepSeek model with Pi flags, enrolled the exact terminal through `worker-start --terminal`, and retained the native receipt.
- The selected-model worker used native `ask` to send `ORCA_ASK_PROBE`, received the coordinator reply, and reported success. Its question and completion were delivered together; both were handled before acknowledgment.
- Reused that terminal for another native Dispatch. The worker sent an idle checkpoint and ended its turn without polling. Sending `ORCA_STEER_PROBE` to its dispatch mailbox woke it; it checked the message and reported success. No Pi polling adapter was added.
- Native release of the enrolled terminal returned `retained / external_terminal / processAction: none`. The caller explicitly stopped its PTY after settlement. This ownership difference is exposed by `clientTerminal` and recorded as [[projects/mlegls-pi/issues/orca-pi-launch-ownership]].
- The migrated `dispatch.dispatch` created a nested worktree and enrolled a model-selected worker. That worker verified `typeof board === "undefined"`, `typeof wm === "undefined"`, and `typeof orca.check === "function"` from a real exec cell, then sent native completion. It made no file edits.
- A fresh direct Kernel probe likewise returned `undefined undefined function function` for board, wm, orca.runs.create, and orca.check. Default/runtime module gates and explicit allowlists disable legacy coordination; the board host was removed from the package manifest.
- Probe deliveries were acknowledged after handling; caller-owned PTYs were explicitly stopped, and the clean isolated worktree was removed. The native Run/task/message records remain as evidence.
- Existing suite: 201 passed, 1 skipped, 0 failed across 32 files. Two board-host acceptance cases and the retired opt-in wm/exec acceptance case were removed with their product surface; legacy library tests remain. The general RPC cancellation/notification test now uses supported term/ui calls. TypeScript and diff checks passed.

## Limits

No app restart, cross-host supervision, arbitrary cross-run permissions, structured decision-gate workflow, or graphical merge was exercised. Native Pi turn-start observation still reports unsupported; input acceptance is weaker than an observed worker response. The new lifecycle does not add a Pi conversation-family tree or tracker ownership. Reader/fork behavior otherwise remains as verified in the earlier migration.

## Size

`scc-delta.sh 90f2af3 lib extensions`, excluding installed `node_modules`: code 12,242 → 12,227 (−15); complexity 3,019 → 3,040 (+21). Added native lifecycle wrappers replace dispatch machinery and retired UI acceptance cases; CLI receipts and explicit ownership avoid a second scheduler.
