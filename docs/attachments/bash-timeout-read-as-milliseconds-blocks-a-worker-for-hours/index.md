# Bash timeout guard: first-use drive

## Setup and predictions (recorded before use)

Revision: `85977e0357ad56b4efde841e8e62b4593260c7b3`. Owned target: the `bash-timeout-read-as-milliseconds-blocks-a-worker-for-hours-drive-2` worktree, local Pi extension; no seed. CLI uses existing local provider authentication, with no application persona required. Handoff supplied `bun test extensions/guard/index.test.ts`; this is a behavior change, so acceptance used actual Pi tool calls instead of the test suite. No source, tests or fixtures were read.

Predictions:
- Direct bash with `timeout: 60000` refuses execution and explains seconds, 16.7 hours, and the process tool.
- Bash nested inside codemode with `timeout: 60000` gives the same refusal.
- Bash with `timeout: 600` executes a harmless print normally.

Only instant print commands were used, so an absent guard could not hang the drive.

## Encounter and readiness

Initial probes through the already-running driver's inherited codemode executed both oversized and normal print commands. That session does not establish deployment of the checkout's changed extension. Acceptance therefore moved to fresh Pi processes explicitly loading this checkout's extension. The fresh runs showed guard refusals, confirming readiness and extension activation. No server or shared target was used.

Two preliminary fresh invocations selecting `openai/gpt-5.4-mini` and `openai/gpt-5.4` stopped before tool use with provider `model_not_found`; selecting `openai/gpt-6.1-terra` worked. One log-extraction attempt used unavailable `python`; Bun extracted the final tool events instead. These were setup attempts, not product failures.

## Replay

Run from the tested checkout:

```sh
pi --offline --no-session --no-extensions -e ./extensions/guard/index.ts --no-skills --no-prompt-templates --no-context-files --no-mcp --tools bash --model openai/gpt-6.1-terra --thinking minimal --mode json -p 'Use bash directly exactly twice: command printf direct-oversized timeout 60000; then command printf direct-normal timeout 600. Do not change timeout after refusal. Read no files. Report outcomes.'
```

For nested dispatch, add `-e builtin:codemode`, use `--tools bash,codemode`, and ask for these two scripts in order:

```js
try { text(await tools.bash({command:"printf oversized",timeout:60000})); }
catch (e) { text(String(e)); }
```

```js
text(await tools.bash({command:"printf normal",timeout:600}));
```

## Observed checks and expectations

| Story/check | Observed result | Outcome |
| --- | --- | --- |
| Direct oversized timeout | `bash` event arguments contained `timeout:60000`; result had `isError:true`, exact refusal below, and no command output. | held; prediction met |
| Nested oversized timeout | Nested `bash` event carried a codemode parent ID and `timeout:60000`; nested result had `isError:true`; codemode caught the refusal as `Error: ...`. | held; prediction met |
| Direct ordinary timeout | `timeout:600` printed `direct-normal`, exit code 0. | held; prediction met |
| Nested ordinary timeout | `timeout:600` printed `normal`, exit code 0; nested call status `ok`. | held; prediction met |

Exact refusal from both surfaces:

> bash timeout is in seconds: 60000 s is 16.7 h; the ceiling is 1800 s. Slow or streaming work goes through the process tool.

Replay acceptance: oversized calls must produce that refusal without printing their marker; ordinary calls must print their marker with exit code 0. Tool event arguments, results and nested parent IDs were inspected directly, rather than relying on the model's final summary. This is a nonvisual CLI encounter; no screenshots apply.

## Frictions and cleanup

The test-runner-only setup handoff required finding the actual Pi launcher and explicitly loading the checkout's extension. Added this encounter to existing owner [mail-drive-handoff-names-only-a-test-runner](../../issues/mail-drive-handoff-names-only-a-test-runner.md). The inherited running session accepting the oversized argument illustrates why fresh checkout-owned activation matters.

All four managed Pi processes exited. No servers, pages, tunnels or other external resources remain. No repository tests were run and no product repairs were made.

## Review

Diff read against the ticket: guard blocks bash timeout above 1800 s with unit and conversion reason; same tool_call hook sees codemode-nested calls (test covers parentToolCallId). bun test extensions/guard passes (2 tests). No repairs needed; no new frictions to settle (the one the driver added went to mail-drive-handoff-names-only-a-test-runner).
