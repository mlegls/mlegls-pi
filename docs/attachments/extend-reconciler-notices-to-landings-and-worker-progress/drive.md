# Independent drive

Revision: `650b63922b3a9ca305aee280a44439bc61648004`.

## Predictions before opening the product

- Landed, parked, withdrew and stopped notices: sending each via the prepared Pi RPC entry point should finish without a remote model call, leave empty assistant output and zero usage, and retain the notice for subsequent context.
- Receipted worker progress: same local settlement as the four run notices.
- Exception: sending the final prepared prompt should wake the selected supervisor model and produce observable provider activity rather than local settlement.
- Recorded follow-up: a notice with a recorded question should likewise reach the supervisor model.

## Setup plan

Use the supplied local Pi RPC preparation command, no authentication for informational messages, normal configured supervisor authentication for exception. The target must be a fresh disposable repository under this checkout's `.wm/`, with a live preparation PID and receipted worker. Wait for `NOTICE_PROGRESS_READY` before launching its emitted entry point. No UI is involved.

## Encounter and observations

Preparation reached `NOTICE_PROGRESS_READY` at `.wm/notice-progress-QIuhIG` within this driver's checkout; its live preparation process was retained throughout RPC use. The emitted Pi RPC command loaded the checkout's prepared extension. No inherited deployment or real thread was modified.

I sent all six `inputs.jsonl` prompts serially, waiting for `agent_end` between them. For containment I disabled tools, MCP, skills and context files, and supplied a short supervisor system prompt requesting `EXCEPTION_AWAKE` for a decision. The model selection/authentication was left at Pi's configured default.

- Landed, parked, withdrew, stopped: held. Each produced empty assistant content, `bb-local` / `worker-completion`, stop reason `stop`, zero tokens and zero cost, followed by `agent_end`.
- Receipted worker progress: held, with the same local settlement.
- Exception: held. The sixth prompt produced `EXCEPTION_AWAKE` through `openai-responses`, provider `openai`, model `gpt-6.1-sol`, with 2,004 input tokens and 9 output tokens. This was a real provider call, not a counted substitute.
- Retained context: `get_messages` after the exception returned all six user inputs. This observes session retention, not provider-side context filtering.
- Recorded follow-up: unobservable from the documented preparation surface. The instructions mention adding a result but do not locate its state or supply a command. I did not inspect source or fixtures to discover it. Tracked as [[projects/mlegls-pi/issues/notice-replay-setup-does-not-expose-recorded-followup-state]].

## Expectations and replayable checks

The five informational settlement predictions and exception wake prediction were met. Retained user input was met through `get_messages`; removal of empty local replies from provider context was not measured. The recorded-question prediction remains unobserved.

Replay: run the committed setup command, wait for its readiness marker, launch its emitted RPC command, and send each line of its emitted `inputs.jsonl` only after the previous `agent_end`. Accept the first five only with empty local assistant content and zero usage; accept the sixth only with an actual non-local provider response. Request `get_messages` and confirm all six user texts remain. For recorded follow-up, the reviewer must first expose an authorized preparation command, then send an otherwise informational notice with a recorded nonempty `handoff.question`; accept only a non-local provider response.

## Frictions and cleanup

The scratch RPC client initially used the unavailable `python` executable; `python3` worked. Its first implementation mixed `select` with buffered text reads and timed out after observing the fourth local assistant message. Replacing that transport read with a reader-thread queue yielded the complete six-turn replay in approximately three seconds. These were driver-client mistakes, not product failures; no failing product claim is inferred from them.

The missing recorded-follow-up setup is the unresolved friction linked above. No browser journey, screenshots, repository tests or source inspection occurred. RPC subprocesses were terminated by the client; the preparation process was stopped after driving.

