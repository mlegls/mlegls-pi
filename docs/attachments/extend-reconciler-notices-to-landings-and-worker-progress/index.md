# Reconciler informational notices: first use

## Setup

Required surface: Pi's BB notice extension, with repository-local reconciler ownership receipts. No hosted deployment or authentication is required for informational notices. An exception uses the supervisor's normal selected model.

From the checked-out revision:

```sh
bun docs/attachments/extend-reconciler-notices-to-landings-and-worker-progress/setup.ts
```

Keep this process alive. It prints `NOTICE_PROGRESS_READY`, an owned scratch Git repository under this checkout's `.wm/`, and a directly runnable Pi RPC command. The fixture supplies `notice-fixture`, worker `thr_fixtureworker`, empty exceptions/results, and the prepare process's live PID. It changes no real tracker/run/BB thread. Stop prepare after use; the fixture needs no service beyond that PID marker.

The emitted `inputs.jsonl` contains RPC prompt commands for landed, parked, withdrew, stopped, worker progress and an exception, in that order. Send each line after the preceding `agent_end`. The first five settle locally with empty assistant content and zero usage. The sixth should use the original model. A later real request should retain the five notice inputs and omit their empty local replies.

To exercise recorded follow-ups, add a result with `handoff.question`, `handoff.caveats`, or `handoff.followup` to the fixture state; nonempty values preserve a model turn. A nonempty `exceptions` map also preserves it. Empty collections/strings do not. Finished run state still certifies terminal notices, while worker tells require a live run receipt. Folded notices settle locally only when every included run notice qualifies.

Independent first-use packet: [drive.md](drive.md).

## Implementation encounter

Tested from base `a1d5902a` plus this change, using installed Pi 1.5.0. Prepared target `.wm/notice-progress-qKrJHf` reached its readiness marker before use; it belongs to this implementation checkout. The preparation process was stopped afterward.

- Actual Pi RPC, explicitly loading this branch's fixture extension: all five informational inputs emitted `agent_end`; their assistant messages used `bb-local` / `worker-completion`, empty content, stop reason `stop`, and zero usage. No provider credentials were needed for these turns. No browser surface is involved.
- Temporary extension-hook replay with a counted fallback model: five informational messages selected the local provider; the exception retained the original model (one fallback-model selection). Every local turn restored the original model afterward.
- Same diagnostic: recorded exception, nonempty question, and nonempty caveats preserved the original model; a finished run's landed notice still settled locally. Worker question, unowned worker and a folded landing-plus-exception passed through. Folded landing-plus-parked and the existing owned core completion settled locally.
- Context replay retained the progress input and stripped its certified local assistant reply.
- `bunx tsc --noEmit`: passed after the final runtime change.
- `bun test lib/notice.test.ts lib/thread/bb-pi.test.ts lib/thread/runtime.test.ts`: 8 passed, 0 failed.
- `git diff --check`: passed.

The exception's provider selection was observed in the hook replay; a paid model call and an end-to-end BB supervisor wake are left to the independent driver. The temporary diagnostics were kept out of the permanent test suite.
