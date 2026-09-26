# Skim fidelity audit — September 26

## Fixed scope

Eight boundary cases cover conditional filing, permission exceptions, evidence limits, numeric bounds, table associations, operation ordering, temporal causality and code branches. The filing sentence comes from the historical issue; the surrounding text and other cases are synthetic. This is a targeted challenge set, not a representative workload or an estimate of production error rates.

Before running live judgments, each case specifies a task, expected answer and exact evidence strings. Evidence-string survival is a diagnostic, not a semantic correctness score: spacing changes can fail it without changing meaning, and all strings can survive while their relationship is damaged.

For each source, run the current production filter twice with (a) the specific task as query, (b) broad orientation query plus the specific task as explicit focus, and (c) broad orientation alone. Relevant decision-bearing passages should be exact in (a)/(b). Orientation may legitimately omit details: review whether the remaining representation misstates the topic, not whether it answers a question the judge never received.

Separately compress every source at 75/50/25 percent. These forced skims expose damage conditional on compression, not evidence that the current selector causes it. Replay the first selection with compressor failure and with a 256-byte budget. Verify all displayed recovery handles against original source substrings. Record actual rendered modes as well as judgments; overhead can turn short skims back into verbatim output.

No prompt changes, routing changes or new production heuristics are part of this audit. Host output caps, a real downstream worker's decision to pull, task completion accuracy and representative calibration require separate checks. Existing historical first-read replays provide a complementary real-source selection check.

Run: `bun docs/research/skim-fidelity/probe.ts > /tmp/skim-fidelity.jsonl`.
