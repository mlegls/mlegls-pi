# Pi launch gates — 2026-09-21

## Observed failure

Run run_ed981e0c6607 launched ctx_dc0af70fad5c and ctx_ca213d869c08 at approximately 11:18 UTC. Both native receipts reported input acceptance, but neither child wrote correlated turn-start evidence. Their persisted sessions contain no user message before 11:24:27, when the coordinator manually sent the specs again. Those later messages lack the original lifecycle preamble. The later provider-credit error is separate from the initial delivery failure.

The adapter previously returned an ordinary successful receipt after its confirmation timeout. The wave therefore continued and left the coordinator to interpret a nested unconfirmed field beneath native ready/input_accepted fields.

## Change

Require child extension session_start evidence before native tui-idle and enrollment. Throw on missing turn-start evidence, retaining the full worker receipt for passive confirmation. The existing wave error path now stops further launches. confirmStart updates the supplied receipt on re-observation. Task-ID launches match the Task ID in the injected preamble.

The startup race is a hypothesis, not a reproduced native root cause. The hard failure gate prevents silent success even if injection is lost for another reason. Native receipts remain unchanged.

## Live checks

- Before the change, short and approximately 9 KB probes both started and settled. Prompt length alone did not reproduce the intermittent failure.
- After the change, ctx_f796e4e72d20 wrote both startup and turn-start evidence and answered FIXED_START_PROBE. It needed a follow-up to use the actual exec tool for settlement; its eventual worker_done was accepted. Turn start is not successful execution or settlement.
- A disposable Pi extension deliberately consumed input with action: handled. Native ctx_ef907a7d061e still reported ready/input_accepted; submit threw with its Task ID, Dispatch ID, terminal handle, and unconfirmed evidence path intact. Passive confirmation remained unconfirmed. No prompt was replayed.
- All four diagnostic terminals were closed. Successful probes were settled/released; the consumed-input probe was failed after confirmed terminal closure. Other runs were inspected read-only.
- Existing suite: 201 passed, 1 skipped, 0 failed. git diff --check passed.
- Typecheck and Jev lint are blocked by the existing missing typescript dependency in lib/lint/extract.ts. No dependency/config changes were made.
- Scoped scc delta against 6677ec1: code 408 → 424 (+16), complexity 141 → 150 (+9), across lib/orca.ts, extensions/orca/index.ts, and extensions/exec/modules.ts.

## Remaining limits

No deterministic reproduction of the original injection loss, remote-host verification, or task-ID launch drive. Evidence files intentionally remain for recovery. Existing workers.abandon passes --reason, which this native CLI rejects; the diagnostic cleanup used the documented native command without that flag.
