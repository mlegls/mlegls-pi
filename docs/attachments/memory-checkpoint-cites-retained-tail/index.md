# Retained-tail checkpoint citations: first-use drive

## Predictions before opening the product

From the ticket and Memory README only:

1. **Folded source + retained-tail citation.** In a fresh Pi session with a few original turns, `/memory fold` should make the current model choose a continuous tail and produce cited prose. If the generated checkpoint cites both an earlier folded entry and an entry in that retained tail, I expect the checkpoint to persist, earlier turns to be folded, and the tail to remain verbatim. `ab memory recall` should find each cited original on the branch. I do not expect the user to have to change the prompt.
2. **Tail-only citations.** If a checkpoint cites only entries in its selected tail (nothing newly folded), I expect the fold to cancel, leaving the conversation intact. I expect to be able to retry. An unknown source ID, malformed output or nonshrinking boundary should likewise not replace history.

These predictions concern validator behavior, not whether a real model can be steered into exact citation choices. The README says checkpoint output is model-selected, and a rejected generation is retained in a private local capture. I expect feedback about whether the fold succeeded, but cannot yet predict the exact UI or CLI wording.

## Setup and encounter

Tested revision: `f744241` in this worktree. The implementer supplied no setup handoff (`null`), so this is a local, checkout-owned Pi CLI/RPC deployment, not a remote service. Persona is a local Pi user with existing DeepSeek provider authentication (readiness: `pi auth check --provider deepseek --json --no-refresh` reported `ready`; no credential copied). Seed is a fresh persisted session under ignored `.wm/memory-drive/sessions/`; entry point is `pi --mode rpc --provider deepseek --model deepseek-flash --extension "$PWD/extensions/memory/index.ts" --no-extensions --no-skills --no-prompt-templates --no-context-files --session-dir "$PWD/.wm/memory-drive/sessions" --approve`. `bun run setup` completed before launch. No inherited deployment selector or shared service was used. Four marker turns received `READY`; Pi RPC reported a session file and nine messages. The initial `compact` returned `Nothing to compact (session too small)`. After this observation, I set a temporary project-local `.pi/settings.json` with `compaction.keepRecentTokens: 64` and `memory.keepRecentTokens: 120` to let this short conversation reach the extension hook, as the Memory README describes; this file is not committed.

## Mixed-source checkpoint: held

Using the same fresh session after lowering the short-session gate, I called Pi RPC `compact` with a focus asking it to retain the last exchanges and remember the compass correction and paper crane. Pi emitted `compaction_end` with no error and persisted a `compaction` entry. The checkpoint's `firstKeptEntryId` was `9488d40d` (Tuesday paper-crane turn). Its `covers` list ended before that boundary (`bacf692b`, `61fa95b9`, `5a188696`, `973a1ce6`, `7f7c7f5c`); its `sources` included folded `61fa95b9` and `973a1ce6` plus retained-tail `9488d40d` and `b620a113`. `ab memory recall 61fa95b9 9488d40d --session <owned-session-file> --leaf 602d4282` retrieved both original user turns. This is live DeepSeek generation, not a mocked validator fixture. The RPC `compaction_end` is the observable success; the following RPC `response` was not captured by my first client because its stdout reader mixed `select` with buffered `readline`. The persisted compaction confirms it completed.

A checkpoint can grow *total* estimated context in a tiny trial (`tokensBefore: 3510`, `estimatedTokensAfter: 3672`), despite replacing a shrinking older suffix; the source/tail distinction above is the claim checked here, not an overall token-savings claim.

## Tail-only checkpoint: attempted, not yet induced

A fresh four-turn session again returned `Nothing to compact (session too small)` even with the temporary small-session settings. I resumed that checkout-owned session and added six card-like turns, then asked RPC `compact` to keep the last two and cite only them. The real model instead emitted extra journal text citing older entries. Pi accepted that checkpoint: boundary `2c388dd1`, `sources` `b85e6ddd` and `09030c53` from the retained tail **and** `9d496307` and `a064e196` from the folded part (`covers` contains both). This acceptance does not test the tail-only rejection claim. The model even generated a self-correction in its prose, but the persisted block still included both old citations.

## Tail-only checkpoint: held

In a third fresh persisted Pi session, I supplied ten ordinary archive/retained marker turns, all answered `READY`. Immediately before compaction I obtained the last two user entry IDs from the session log (`30bcd26f`, `e1b5431d`) and asked the model through RPC `compact` to start the tail at `30bcd26f` and cite exclusively those two entries. The generated checkpoint began `tail: 30bcd26f` and its only citations were `[@30bcd26f]` and `[@e1b5431d]`; the relevant excerpt was: “Two retained-event items arrived in this stretch, both about the same object. [@30bcd26f] records … [@e1b5431d] is a retained correction …”. Pi emitted `compaction_end` with `aborted: true`, RPC returned `success: false, error: "Compaction cancelled"`, and the session still contained 38 entries with **zero** `compaction` entries. The failed candidate remained privately at `.wm/memory-drive/sessions/memory-failed-01a0f097-7bbc-75a3-8c7d-5ea05f4264da-1790742883744.md`; it is not committed because checkpoint captures may include private session text. The quoted IDs/text above and the no-compaction count are the durable evidence.

## Frictions and expectations

- **Met:** A mixed folded/tail-cited checkpoint persisted without changing the shared prompt; the original entries remained recallable. The generated boundary was earlier than the paper-crane turn, as anticipated.
- **Met:** A real tail-only candidate was rejected; all original turns survived. `Compaction cancelled` alone is nonspecific, but the saved candidate's only citations were in the selected tail and there was no compaction entry.
- **Not met:** Four short turns did not reach the extension despite a manual `compact`; the RPC error was `Nothing to compact (session too small)`. Lowering the native gate made one resumption work; another four-turn fresh session still needed more turns. A first-time user does not know how many turns are enough from that message.
- **Friction:** A focus asking for only tail citations was not honored on one attempt: the model added older citations and Pi rightly accepted the mixed-source result. Reproducing the negative case requires inspecting the generated candidate, not just the RPC status.
- **Friction:** A canceled fold's RPC error does not identify why it was canceled. The candidate was saved as `memory-failed-*.md`, while the Memory README says blocked checkpoints save `memory-checkpoint-*.json`; no such JSON appeared in this trial's owned session directory. The Markdown candidate sufficed here, but the documented discovery path did not. Tracked in [[projects/mlegls-pi/issues/archive/memory-cancelled-checkpoint-capture-discovery]].

## Replayable checks

1. **Mixed provenance:** In a fresh persisted Pi session with small native compaction gate, send several original user turns with distinguishable early facts and recent facts; request manual compaction with focus on both. In the public RPC result or persisted session, accept only if `firstKeptEntryId` precedes the recent cited user entry, `details.blocks[0].sources` contains at least one user ID in `covers` and at least one ID at or after `firstKeptEntryId`, and a `compaction` entry is appended. `ab memory recall` of both IDs must return their original user messages.
2. **Only tail citations:** With at least ten prior turns so Pi permits compaction, identify the last two user IDs from the persisted session; request a boundary at the penultimate user and a journal citing only those IDs. When the generated candidate indeed has no folded citations, expect RPC `success: false` / `Compaction cancelled`, no `compaction` entry, and all previous turns still present. Check the candidate, not merely the requested focus: a model may cite older IDs regardless.
3. **Other fail-closed cases, not driven:** A candidate with an unknown citation, missing `tail:` line, or a boundary that folds nothing should leave the original session unmodified and report cancellation. This live-model drive did not produce those outputs; force candidates through a controlled public provider in a separate check rather than treating a successful model response as coverage.

Nonvisual CLI/API journey; no screenshots. The long raw RPC stream and private session files remain in ignored `.wm/`, not this packet. This index preserves the selected status, IDs, boundaries, and citations needed to judge the stories.

## Review replay

Reviewed the change from `dd0836cf` through `1199804` together with the first-use record. No production defect found; shared prompts remain unchanged. Citation eligibility still comes from visible originals plus branch-local prior evidence; acceptance additionally requires a citation in the newly folded coverage.

`extensions/memory/memory.test.ts`, “model-selected contiguous tail, stable append/resume and failed checkpoint”, replays checks 1–3 through Pi's registered `session_before_compact` extension hook with controlled model responses. The accepted response returns mixed provenance without covering its retained-tail citation, preserves the tail on resume, and both original messages remain readable through public `memory.recall` after session persistence. Tail-only output cancels on both fresh and already compacted histories; a retry with mixed citations succeeds. Unknown IDs alongside valid citations, a missing boundary, a boundary folding nothing, and truncated output also cancel without modifying the branch or visible conversation.

This is a deterministic extension-API replay, not another live-provider RPC drive. The original live RPC evidence above remains the end-user confirmation. No production behavior changed during review.

Disposition of the first-use expectations/frictions:

- Mixed-source acceptance, retained-tail preservation, recall, rejection and retry: held; encoded in the replay.
- Short-session gating: outside citation validation; filed as [[projects/mlegls-pi/issues/archive/memory-short-session-compaction-gate]].
- Focus not inducing tail-only citations: outside this change; recorded with the existing [[projects/mlegls-pi/issues/archive/compaction-register-variants]] owner. Tests supply the actual candidate rather than assuming focus compliance.
- Nonspecific cancellation and capture discovery: remains owned by [[projects/mlegls-pi/issues/archive/memory-cancelled-checkpoint-capture-discovery]].

Validation: `ab check -- bun test extensions/memory lib/memory.test.ts` — 17 passed, 0 failed, 164 assertions. The first replay exposed an incorrect test expectation (recall preserves a user message's string content, rather than converting it to text blocks); the expectation was corrected and the complete affected suite rerun. No servers, browsers or external deployments were started during review.
