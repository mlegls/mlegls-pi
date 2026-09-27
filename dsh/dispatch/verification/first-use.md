# Dispatch implementation self-check

2026-09-27, live DeepSeek, checkout-owned Web host. This is implementation
first use, not independent acceptance or browser UI verification.

The final wave used `acfec2d` with the optional-allowlist fix. Parent
`75fd78fe-6584-48b4-8605-6880022f5b51` finished `READY` and became idle at
12:48:01.068Z. Its PTC `Promise.all` returned three handles at 12:48:01.479Z,
with `idle: true`, before the probe released the children's pre-step gate.

| Role | Child session | Topic |
|---|---|---|
| Research | `4bcd0edc-bdeb-4fec-afd5-7d9a1c2538c3` | `mail/1c2538c3` |
| Crash | `0c2b0e4b-6853-4fc7-8e2d-b4c7f66412b6` | `mail/f66412b6` |
| Fill | `4b878a91-0f41-47a6-96ae-a39e3a88ab37` | `mail/3a88ab37` |

The crash was an injected exception in the real child pre-step, not a forged
board event or cancellation. Its mailbox contained `mujtdm13-vnjb4x` (`crashed`,
`DSH_CRASH_PROBE: deliberate child pre-step failure`), `mujtdm14-vgwkl4`
(error turn-end), and `mujtdm1d-hqzags` (`exited`). A `subagent-settled` notice
woke the idle parent at 12:48:01.492Z. These children are in-process; no
independent child PID exists. Killing the host process was not tested.

The research child successfully called `tools.read` on `package.json` and
returned `DSH_IDLE_WAKE_RESULT`, package `mlegls-pi`. Board result
`mujtdrco-jh5mdy` and exit `mujtdrcv-cxthfd` arrived in the parent's board inbox
at 12:48:09.289Z. Its recorded tool surface contained read/grep/board tools,
not shell/edit/write/dispatch.

The writer's durable `tool/ptc-dispatch` at seq 20 records `shell`, arguments
`{"command":"pwd; git rev-parse HEAD"}`, `isError: false`, and exit code 0:

```text
/Users/mlegls/dev/mlegls-pi__worktrees/dsh-templated-spawn-and-dispatch__worktrees/dsh-4b878a91-0f41-47a6-96ae-a39e3a88ab37
acfec2dae8c151157e24cc59ea53ba7d29076930
```

The parent read the child topics and completed turn 2 at 12:48:17.753Z,
record `mujtdyl5-x4qrwt` on `mail/022f5b51`. The parent did not poll or receive
a second human prompt. Settlement caused the initial wake; board notices and
full readback supplied the board results. This does not isolate a board-only
wake from the upstream settlement wake.

Local raw state: `dsh/.local/dispatch-web-probe/dispatch-probe.jsonl` and that
home's durable session archives. Web was stopped after settlement; the clean
no-edit writer checkout and branch were retired. The probe in `README.md`
recreates the starting state with fresh identifiers.

Existing regressions: 9 route/dispatch tests and 1 board test pass. Frozen dsh
install, plugin build and focused strict TypeScript check pass. Tracker check
still reports unrelated existing lifecycle/link findings. Semantic lint flagged
unowned process-death evidence (p=0.66); the ticket now links that boundary to
project-scoped sessions/worktrees. Automatic
routing selection, capacity saturation, cold continuation and writing commits
remain for the supervisor's verification scope; this encounter pinned stances.
