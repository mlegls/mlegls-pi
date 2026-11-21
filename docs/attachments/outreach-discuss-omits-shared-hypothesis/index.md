# Discuss two people with a shared hypothesis

## Predictions before first use

As a signed-in maintainer, I expect the demo Candidates view to let me select Pat and Charlie and offer **Discuss 2**. I expect that action to open a draft with Pat, Charlie and exactly one **Busy operators** attachment. After I submit a prompt I expect the sent message and the thread header each to show both people and one copy of the shared hypothesis. I expect no chat-account setup.

## Setup

Tested `bb-plugins` `fb98bae` from the built `tracker-outreach-combined` checkout on the Beelink, with a signed-in BB desktop tab on the MacBook. From that checkout's `tracker/`, ran `bun scripts/outreach-demo.ts create`; `bb plugin rpc call tracker outreach --json` returned the new project (`proj_gmt75bhesh`) with Pat, Charlie, Rhea and `busy-operators` before I opened the printed route. No chat accounts or sync credentials were needed. Screenshots are from the live English desktop journey, 1280 × 720, using disposable demo data.

## Replay and observed results

| Check | Replay and expected result | Observation |
| --- | --- | --- |
| Candidate selection | Open the printed route, switch from Queue to Candidates, and check Pat Candidate and Charlie Candidate under **Busy operators**. Expect **Discuss 2**. | Met. Both boxes checked and the button changed to **Discuss 2**. |
| Draft | Click **Discuss 2**. Expect both people and exactly one shared hypothesis. | Met. **Discuss 3 records** showed one removable chip each for Pat Candidate, Charlie Candidate and Busy operators. [Draft](draft.jpg) |
| Sent message | Enter “Name the people and hypothesis attached to this discussion.” and submit. Look at the first user message, separately from the reply. Expect exactly three attachment chips. | Met. The first user message had one chip per record. [Sent message](thread.jpg) |
| Thread header | Click **Outreach 3** in the new thread header. Expect exactly three records in its panel. | Met. The panel had Busy operators · hypothesis, Charlie candidate · person and Pat candidate · person, once each. [Header and open panel](thread.jpg) |

## Friction and cleanup

The shared tracker installation switched to the canonical checkout during the first pass. The sent chips were present but the header action was absent. Reinstalled the candidate, rechecked RPC readiness, and replayed from Candidates through Submit without a deployment change. The second pass produced the evidence above. The header shows a count until clicked; the record names appear in the panel.

Closed the owned browser tab and restored the canonical tracker installation. The disposable project and its two threads remain for review; no dev server was started.

## Review

Reviewed `bb-plugins` `c4e1c1b..fb98bae` (`tracker/outreach-page.tsx`) against this log and both screenshots. `discussPeople` now attaches the selected people followed by the union of their linked hypotheses, deduplicated by slug, so Pat and Charlie share one **Busy operators** target. The heading counts mixed targets as records. `bunx tsc --noEmit` in `tracker/` passes at `fb98bae`. No repairs; all three checks hold as recorded.

Nit left as is: the thread-header panel labels person records from their slug (`Charlie candidate · person`), while the chips use the person's name (`Charlie Candidate`). The label comes from `ThreadOutreachPanel` (from `c20a38b`), not from this fix.
