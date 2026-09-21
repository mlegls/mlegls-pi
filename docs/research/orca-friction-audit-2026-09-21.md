# Orca friction audit — 2026-09-21

Baseline: package commit 7d36956; macOS, Orca 1.4.206, Pi 0.85.1. Live local probes, not an upstream source audit. Disposable Run: run_5efdbd489e37. No product code changed.

## Findings

1. **Completion capability: current injection works; reconstructed preamble is incomplete.** The actual injected prompt included --dispatch-capability for completion, heartbeat, ask, and escalation. Coordinator-side dispatch-show --preamble omitted it. Worker ctx_f689cd3bfbf0 initially called nonexistent tools and misdiagnosed capability absence; terminal history disproved that diagnosis. After correction to execute the injected CLI through sh, worker_done succeeded (msg_dd88d8cfc51d) and Task task_7f512eee3f83 became completed. A second Dispatch also reported structured failure successfully. Old dispatch migration and worker-side reconstruction were not tested.

2. **Start confirmation: new enrollment timing failure prevents a blanket resolved verdict.** workers.submit with deepseek/deepseek-chat and effort off created a Pi terminal, then failed with agent_unconfigured before creating any Task or Dispatch. Read-only enumeration confirmed both collections empty. Pi subsequently appeared at an idle prompt; explicit enrollment of the same terminal succeeded. This supports a readiness race, not a model/configuration failure. No blind resubmission occurred. The earlier correlated-event verification remains valid, but this run did not verify an end-to-end successful submit/confirmStart path.

3. **Terminal API mismatch reproduced, not contradictory host liveness.** term.view(Orca handle) returned HostServiceError: Unknown terminal session; term.list was empty. orca.workers.read on the corresponding Dispatch succeeded and reported live agent status. lib/session/host.ts uses TmuxTerminalManager; these are separate handle spaces. The original missing-tmux-socket error was not reproduced. After deliberate terminal closure, worker-show correctly reported exited and non-writable.

4. **Native passive observation gap reproduced.** terminal send --terminal <handle> --wait-submit 1, without text/enter, returned invalid_argument: "--retry-request and --wait-submit require --text with --enter and without --interrupt." The recovery guide's observation wording does not supply a standalone existing-prompt observation operation. Did not resend an accepted prompt. Local confirmStart remains the narrower adapter alternative described in the earlier start-confirmation report.

5. **Native Pi model selection still rejected.** worker-start --agent pi --model deepseek/deepseek-chat --effort off returned invalid_argument: "Agent pi does not support launch-time model selection." No Task was created by this attempt. The two-stage local workaround additionally encountered finding 2.

6. **Explicit retry works; repeated stop failure not reproduced.** Dispatch ctx_b43178d85435 sent accepted worker_done outcome failed. Bare start of its Task returned task_not_startable, with explicit retry guidance. The same terminal and placement with retryOf succeeded as ctx_e91b57cdf533. During that disposable retry, terminal close was used as deliberate fault injection, not inferred-death cleanup. It returned ptyKilled:true; worker-show recorded failed/process_exited, operator_close, and exited. worker-stop then succeeded on its first call with alreadySettled:true and processAction:none. This tests operator-close recovery, not an unobserved process crash or the old dispatch_inactive sequence.

7. **Blank model picker not reproduced.** Sent /model while the worker's sleep 20 tool call was running. Rendered-screen read showed a populated picker, current DeepSeek selection, configured models, and "Model catalogs refreshed." Escape cancelled it; the worker continued and sent its intended failure report. Credit exhaustion and selecting a different model mid-turn were not tested.

8. **Worktree is not a filesystem boundary.** Created child worktree friction-audit-0921. A shell terminal launched there ran Bun to exclusively create a uniquely named canary in the canonical checkout, printed CANONICAL_WRITE_ALLOWED with its child-worktree cwd, and removed the canary. No permission warning or refusal occurred. This proves no blanket terminal filesystem isolation; it does not separately test a dispatched agent's tool-specific guard or detect a stray commit. No existing file or Git history was modified by the canary.

9. **Waiter exclusivity reproduced; orphaned waiter not reproduced.** While one 15-second wait was pending, a concurrent consuming wait returned waiter_exists. A new wait worked after the first timed out. Separate CLI waits were terminated after 1.2 seconds, once with SIGTERM and once with SIGKILL; after 300ms, a fresh wait worked in both cases. No fallback polling was necessary. Application restart and remote connection loss were not tested.

## Additional boundary observed

Creating a separate Run with --from another terminal was refused because this process is attested to its real terminal. The unused disposable coordinator terminal was closed. The audit instead temporarily bound this terminal to its own new Run and restored its original binding afterward. Recovery must respect this caller identity; a handle alone is not authority.

## Cleanup and outcomes

- Task task_7f512eee3f83: completed by accepted worker report; terminal immediately reused.
- Task task_0e3d5c81fbf8: intentional failed report, followed by controlled retry/terminal-loss test. Operator closure made the Task ready again; coordinator explicitly marked the disposable fixture failed with audit-cleanup provenance, rather than leaving work pending or fabricating worker completion.
- Both delivered completion batches processed and acknowledged. No reclaimable workers remained.
- Caller-owned Pi terminal closed during fault injection; release correctly returned external_terminal/processAction:none. Canary terminal and unused coordinator terminal closed; disposable worktree removed; canary absence checked. Historical Run/Task/Dispatch records remain as evidence.
- Original Run run_035a0f5bc21d restored. No other workers or user files touched.

## Next work

Fix the adapter's Pi-ready/enrollment sequencing without replaying ambiguous starts. Clarify native versus local observation and terminal handle spaces. Upstream: standalone prompt observation and Pi launch preferences; decide whether canonical-checkout write protection is a desired product boundary. Investigate old capability injection and waiter conflicts only with the original Dispatch/version or a stronger reproduction.

## Local fix verification

The adapter now waits for native terminal tui-idle readiness before its single enrollment attempt. Only wait.satisfied:true permits submission; timeout/error/missing readiness retains the exact terminal and recovery envelope without submitting or retrying. timeoutMs bounds readiness as well as enrollment; startWaitMs still bounds correlated turn-start observation.

Live verification on 2026-09-21 (Run run_cf2acc5513be):

- workers.submit with deepseek/deepseek-chat/off returned Dispatch ctx_9a3608e262df and startConfirmation.status:started. Worker task_4e2142a90328 then sent accepted worker_done succeeded (msg_0c8bd56258fd). Release reported external_terminal; the caller-owned terminal was closed, completion acknowledged, and no reclaimable workers remained.
- A controlled non-agent launcher (PI_ORCA_COMMAND set to sleep 60 with remaining arguments commented out) and timeoutMs:1000 returned native timeout before enrollment. The retained terminal was inspected and closed; Task enumeration contained only the successful smoke Task, proving no timeout-fixture assignment was submitted. This exercises a timeout error, not a successful wait receipt with satisfied:false.
- Original coordinator Run restored. TypeScript check passed; full existing suite with BB_THREAD_ID unset: 201 passed, 1 skipped, 0 failed.
- docs/orca.md now distinguishes native readiness, correlated turn-start observation, terminal handle spaces, live versus reconstructed preambles, and checkout separation versus filesystem isolation.

The native passive-observation and Pi launch-preference gaps remain upstream; no native Orca behavior was changed. No sandbox was added.
