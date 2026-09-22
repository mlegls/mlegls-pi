# Focus-dependent retention replay — 2026-09-22

Starting ref: 305945c. Standalone prototype, not a change to live exec ingress.

Jev chooses one of full / 75% / 50% / 25% / omit for each passage and reading.
LLMLingua-2 XLM-RoBERTa-large supplies token deletion at the chosen intermediate
rate. Full and omit bypass compression. The 25% representation is explicitly
labelled keyword cues, not assertions; 50% and 75% are labelled incomplete skims.
The object’s name supplies passage identity. Source originals are retained by ID
in the receipt, independently of compressed text. These are receipt lookup IDs,
not handles registered with the running kernel's show.pull.

## Run

~~~sh
# Uses the same Jev credentials as lib/decide.ts; local weights are already cached.
bun docs/research/caveman/retention.ts > /tmp/retention.json
# Optional: DEVICE=mps (this replay used CPU).
~~~

The Python comparison probe also accepts --jobs with stdin JSON containing a jobs
array; each job has name, source, and rate (0, .25, .5, .75, or 1). It loads one
model for the batch. The original three-rate comparison remains the default.
No persistent local service, ingress wiring, or byte-budget demotion is implemented.

## Observed choices

Final prompt asks for the **lowest retention sufficient for the current reading**.
One shared source collection per reading intent; four independent Choice questions
per request. Six reading requests run concurrently. Raw choices/distributions are
retained; there is no low-confidence promotion to full or post-hoc rate adjustment.

| Reading | Engineering update | Receipt protocol | Medical pilot | Reading policy |
|---|---:|---:|---:|---:|
| Main ideas, then choose what to reread | 50 | 25 | 50 | 50 |
| Architecture orientation | 50 | 0 | 0 | 50 |
| Prepare to edit reading policy | 25 | 0 | 0 | 100 |
| Decide retry / receipt deletion | 0 | 100 | 0 | 0 |
| Interpret treatment evidence | 0 | 0 | 100 | 0 |
| Browse topic cues only | 25 | 25 | 25 | 25 |

The four sources total 3,420 UTF-8 bytes. Including display notices, the architecture
render was 1,742 bytes, gist 1,981, editing 2,671, retry 333, medical 352, and browsing
1,070. These are byte savings, not target-model token measurements or accuracy scores.
Requested retention is not a guaranteed realized token ratio.

At 50%, the engineering update starts:

> drive integration bug exec objects cross VM boundary prototype discarded. Fixed.
> focus reaching Jev source reading 5 KB sketch from 16 KB inspection retained full source. recovered originals.

At 25%, the receipt protocol becomes:

> request cancelled. client server retain receipt. Retry. timeout prove.

The latter is useful only as a cue to the subject matter, not a protocol specification.
For an actual retry decision Jev selected the untouched original. This contextual
allocation, rather than standalone-summary fidelity, is the behavior under review.
Whether a downstream reader reliably reconstructs or expands damaged passages has
**not** been established by this replay. Labels change reading posture, not the text's
semantic correctness. Nor does the replay establish whether callers will expand at
the right time.

## Prompt iterations and uncertainty

All three encounters are retained, not only the favorable last one:

- retention-shared-intents.json: all five intents in one shared state, indexed by
  questions. Unrelated passages were sometimes marked full (including the medical
  pilot during retry work). Architecture/update selected 75%.
- retention-focused-before.json: separated intent state and explicitly prioritized
  relevance to the current task. Irrelevant full selections disappeared, but relevant
  orientation passages stayed full. Two things changed, so this does not isolate the
  cause of the improvement.
- retention.json: additionally asks for minimum sufficient retention, and adds the
  gist encounter. The table above describes this run.

The final architecture choices were close: update 50% probability .36 versus 75%
.35; policy 50% .36 versus 75% .34. The edit/update selection was very diffuse
(25% won at .24). No 75% choice won the final run; it remains a live option and was
exercised in the first iteration. These are uncalibrated policy boundaries, not
five cleanly separated perceptual states. The existing ingress .6 → full rule was
intentionally not copied: it would hide the neighboring-rate ambiguity under full
text rather than let the prototype be inspected.

## Checks and friction

The final live replay completed all 24 renders. Every full render matched its stored
original exactly; all outputs were no larger than their inputs including notices;
every ID recovered its original from the receipt. The original Python comparison
also ran unchanged: all twelve outputs matched the previous BERT CPU receipt.
git diff --check passed. Interactive inspection is the review for this prototype;
no downstream task or production integration tests were added.

Jev selection took about **31.8 seconds** wall time across six concurrent requests
(the two earlier passes were also about 31 seconds). That is unsuitable for the
current live ingress deadline; the cause was not investigated in this experiment.
This receipt uses the direct TypeSafe endpoint with jev-1.13.0. Local model startup
and compression timing are recorded separately. There is no latency/accuracy claim
for a deployed pipeline.
