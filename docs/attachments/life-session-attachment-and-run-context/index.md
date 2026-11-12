# Life first-use drive

The implementer's earlier encounter is retained separately as [previous drive](previous-drive.md). This independent encounter does not replace its historical observations.

Tested revision: `b23e2014f46e42592eb10d2032c83fba5eec393d`. Independent driver; implementation, diffs, tests and fixtures were not read. Public surfaces: real pi CLI/RPC, life tools, and bb CLI thread operations. No rendered journey; visual false, screenshots none.

## Predictions recorded before first use

- Two real pi sessions on one new temporary store should share a machine-wide named life; notes should remain available.
- Attaching prior history should make that history available elsewhere. Holds and unfinished sibling work should be discoverable during overlap; completed work should enter the next run, and catch_up should expose newer committed leaves.
- Resume/fork and model changes should preserve attachment; explicit off should survive resume and leave OM with no life-only tools.
- PI_LIFE should disappear from child environments; explicit worker attachment should work.
- With tailBytes 800, a long tool-using run should retain its whole user request and complete tool pairs while committing prefixes before advancing its view.
- Zoom/date should inspect positions newer than the fixed view.

## Setup and reproduction

From this checkout run `bun scripts/life-playground.ts prepare`, then `bun scripts/life-playground.ts start <root> one --mode rpc` and the same for slot two. RPC accepts newline JSON `{"type":"prompt","message":"..."}`. Wait for agent_end after ordinary prompts; slash commands instead acknowledge disposition handled, with extension notifications. The driver's initial command waiter mistakenly waited for agent_end on handled commands, producing harmless 3–8 second local timeouts. No request was cancelled because of those command timeouts.

Fresh terminal target: `/tmp/pi-life-hgWnTO`, machine-wide name `/pi-life-hgWnTO`, store under its `store/`, session files under `sessions/<slot>/`. Created by this driver, not inherited from implementer. Notes enabled, tailBytes initially 800, waitSeconds 30. Authentication: existing host pi Anthropic credential; Haiku 4.5. Readiness established by completed live requests in both sessions. No credentials copied. Public guide: [Life README](../../../extensions/context/life/README.md).

For bb, separately ran `bun scripts/life-playground.ts prepare-bb`, obtaining owned `/tmp/pi-life-I7Y5TF`, name `/pi-life-I7Y5TF`. Spawned two Pi threads on that exact path with model `anthropic/claude-haiku-4-5`. Confirmed environment `env_89t2qjzykf` on `host_a22uydxjy2` was ready with path `/tmp/pi-life-I7Y5TF`. Real hold/tool responses established runtime readiness. No browser deployment was involved.

## Encounters and outcomes

### Shared life, holds, environment and notes — held

1. Slot one called hold("cobalt bridge design"), bash `echo "$PI_LIFE"`, then remembered COBALT-731. Hold returned `Holding: cobalt bridge design`; child bash printed an empty line.
2. Slot two's first run saw COBALT-731 and cobalt bridge design without that information in its own user prompt. It held "amber route review". A later run identified both actual session IDs and their holdings:
   - one: `01a1cdcf-f440-77d6-9f22-caf6119b0dab`
   - two: `01a1cdcf-f311-744f-a050-e0c28a7526d3`
3. In another attached slot, note("life drive note JADE-118", project) returned `Saved to project as #0`. A subsequent fresh attached slot saw JADE-118 alongside prior life tokens. Notes composed with life.
4. A new explicitly named worker slot attached through the launcher's PI_LIFE and saw prior completed work. The empty child environment and explicit worker launch together establish the requested inheritance distinction at these surfaces; no child launched with an implicit attachment was observed.

### Controlled overlap, catch_up and newer zoom/date — held

At tailBytes 800, catch_up initially kept returning `(nothing new)` even after another run completed. The guide explains that long-run advancement can move the view; this was not treated as a failure. Raised only this disposable target's tailBytes to 1000000 before starting slots three/four.

Slot three held "indigo active", slept 20 seconds, then completed with OVERLAP-554. Slot four started during that sleep and issued only bash sleep 35 in its first assistant message, then catch_up after receiving the result. This sequencing matters: the initial attempt let the model batch sleep and catch_up in one message, which did not establish a later read.

The controlled catch_up returned places 45–51 from session `01a1cdd1-9642-7606-8b7c-ea3f38c11103`: whole user request, assistant text, hold and bash calls, both results, and final OVERLAP-554. Then zoom({id:45,n:1}) returned the exact user request with source `entry:01a1cdd1-9642-7606-8b7c-ea3f38c11103/7ac22642#0`, model and timestamp. date({id:45}) returned `2026-11-12T03:33:47.638Z`. These positions were newer than slot four's fixed starting view.

### Two bb sessions and unfinished sibling — held, with friction

Fresh bb threads: @thread:thr_asc9cs23cc (indigo) and @thread:thr_a8sn4m7xsr (amber). Indigo held "indigo bridge", then ran sleep 65. While it was sleeping, amber held "amber route" and called catch_up({thread:"thr_asc9cs23cc"}). The returned messages included the hold result and still-unfinished sleep call; amber correctly reported the sibling's held work and active sleep.

The payload was 539 lines / 14,543 tokens, including system sections, tool definitions and opaque signatures. Codemode truncated its display. This was unexpectedly large for the task; the tracker issue `life-unfinished-sibling-read-large-system-payload` owns that friction (see links below).

Amber then slept 80 and called catch_up(); it returned nothing new at the default small tailBytes, but the run already saw indigo's final BB-INDIGO-441. On amber's following run, a user prompt asking only for the sibling token returned exactly `BB-INDIGO-441`. Thus completed work survived into the next run. CLI controlled-overlap above independently established catch_up's newer leaf behavior.

### Attachment persistence, model, detach and history — held with one inference limit

- set_model RPC changed slot three from `claude-haiku-4-5` to `claude-haiku-4-5-20251001`, acknowledged success. `/life` still reported `/pi-life-hgWnTO`. This verifies a model-ID change, not a different model family.
- `/life off` on slot one notified `Life: off`. The next ordinary request emitted toolsRemoved for hold, catch_up, zoom and date, started an OM observer and later reported five observations recorded. Model prose nevertheless listed the old tools: its own inventory was stale, so the structural RPC events are the evidence for removal.
- Restarted slot one's saved session with `--no-life-env --session <file>`: `/life` returned `Life: off`.
- Forked slot two's saved session using a new slot and `--no-life-env --fork <file>`: `/life` returned the named life.
- New detached history slot (`--no-life-env`) received HISTORY-220, then `/life /pi-life-hgWnTO`. A new named worker's first run saw the earlier HISTORY-220 recall attempt at place 72+1, proving history attachment crossed the session boundary. Its prose mistakenly interpreted the prior model's "not found in records" response as absence of the token. Literal token recall quality was therefore not established by that answer; the prior history was visibly present.

### Long run, prefix commits and coherence — failed

Restored tailBytes 800. A first run made six bash calls printing different words 150 times, with WHOLE-USER-963; all results completed, and the final response retained the marker. Subsequently a new session `01a1cdd4-ebbc-72aa-9cd3-1f4b9633bdf4` received a whole user request containing PRESERVE-612 and made four sequential bash calls in distinct assistant messages. Each was `python3 -c "print('word N ' * 250)"`, N=1 through 4.

All four results arrived successfully before the next call. Before the final assistant reply, catch_up returned committed prefix positions 75–84, details upTo 85. Position 75 retained the whole current user request; positions 77/78,80/81,83/84 were complete call/result pairs. The fourth pair remained in the current run outside that returned prefix. This establishes a committed safe prefix during the unfinished run, but does not expose internal save ordering or prove boundary/view atomicity.

Semantic coherence failed: the result leaves said 150 repetitions instead of 250. Excerpts:

- `78+1|echo@...: bash stdout "word 1" repeated 150× (first of six bash calls printing different words, user marker WHOLE-USER-963)`
- `81+1|echo@...: second bash test output—'word 2' repeated 150 times, tool result stayed readable after catch_up`
- `84+1|echo@...: bash command output—"word 3" repeated 150 times (~1200 chars total; tool result remained intelligible despite truncation/compression)`

These mix prior work into the current run. Final reply did preserve PRESERVE-612 and correctly said four calls of 250 completed. Originals were not re-opened through zoom in this encounter, so this is a failure in the returned prefix summaries, not established corruption of original source copies. Owner: `life-long-run-prefix-summary-mixes-earlier-work`.

The sequential run took about 3m45 overall, including a substantial pause after the fourth result. At 180 seconds the driver tried an inspection prompt while the run was still active; RPC correctly rejected it with `Agent is already processing`. The original run subsequently completed. No acceptance claim relies on that rejected inspection.

## Frictions and owners

- [Summary contamination](../../../docs/issues/life-long-run-prefix-summary-mixes-earlier-work.md): failed coherence above. Needs reviewer repair/re-drive.
- [Empty compactor reply warning](../../../docs/issues/life-first-use-compaction-empty-reply-warning.md): once after the initial tool-heavy run, `/life` was followed by `life: compaction failed: empty reply`. Main run completed. No data loss established; not reproduced in the sequential round. Continuing the session worked.
- [Oversized sibling payload](../../../docs/issues/life-unfinished-sibling-read-large-system-payload.md): unfinished read worked, but included large unrelated system material.
- Small-tail catch_up and model batching made the initial overlap trial hard to interpret. Documented high-tail and separate-response sequencing produced an observable controlled result; this friction is resolved in the replay procedure above.

## Expectations and replayable checks

| Expectation | Outcome | Replay / acceptable observable result |
| --- | --- | --- |
| One shared named life across real sessions | met | Put unique token in one completed run; next fresh attached session sees it without repeating token in its prompt. |
| Holds show where else work is active | met | Hold distinct labels in two sessions, ask for present; both session/thread identities and labels appear. |
| Unfinished sibling is inspectable | met | Sleep 65 in one bb thread; catch_up(thread) from the other before completion contains the still-open sleep and held label. |
| Completion can be caught up during overlap | met in controlled CLI run | Raise tailBytes before starting sessions, sleep 20 in A and 35 in B, then B calls catch_up in a later assistant message; expect A's final token with places. |
| Newer places support zoom/date | met | Use the returned newer place; expect exact user text/source and matching date. |
| Notes remain beside life | met | Save unique project note while attached; expect success and later visibility. |
| Attachment survives model/fork; off survives resume | met | Model-ID change, fork without environment override, resume detached session; `/life` reports expected persisted choice. |
| Detach gives accurate model inventory | not met in model prose | Detach then ask tools; inspect actual toolsRemoved event rather than trusting its recalled list. OM observer started. |
| Whole user and complete prefix pairs survive a long run | met at public prefix surface | Four sequential calls exceed 800 bytes; catch_up before final reply includes whole user and completed pairs, no orphan result. Internal ordering remains unobservable. |
| Summary counts and provenance stay coherent | not met | Precede four-call 250-repeat run with six-call 150-repeat run. Every current result summary must preserve 250/current marker; observed 150/prior marker fails. |
| Child does not inherit PI_LIFE | met | Attached model's bash echo prints empty; explicitly named fresh worker still sees shared life. |

## Limits, remaining gates and cleanup

No source-level claims about monotonic saved-view replacement, concurrent builder waiting or exact append-before-boundary transaction order are established by this drive. Interrupted-history recovery was not separately driven. Repository-local bare-name isolation was not exercised; machine-wide naming was. These remain acceptance work of the active attachment ticket, not waived requirements. Hermes import and Beelink trial stayed out of scope.

All driver-created CLI/RPC processes were terminated by their owning harness after each trial. Both bb threads were stopped and archived after successful completion; generated directory trust was removed with the documented untrust command. No servers, tunnels, containers, browser pages or applications were started. Disposable workspaces `/tmp/pi-life-hgWnTO` and `/tmp/pi-life-I7Y5TF` retain trial data for reviewer replay; no runtime remains intentionally active. No product repairs or tests were made by the driver.
