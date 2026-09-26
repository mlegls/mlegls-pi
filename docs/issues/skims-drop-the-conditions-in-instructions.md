---
stage: idea
author: session:2026-09-24T07-05-04-311Z_01a0d23b-6a37-75f1-bad0-4832beff35f3
---

Ingress skims can drop the words an instruction turns on, and skill text gets skimmed. On 2026-09-23 a `verify-story` worker (gpt-6-luna, medium; session `2026-09-23T04-35-48-178Z_01a0cc8c-6551-73ae-8b88-2bd59a1f7cbd`, JSONL line 11) read `project-docs`' rule "frictions - Ousterhout symptoms or deferred costs, recorded for later triage. issues in a vault project (`tracker`), one-liners in `docs/frictions.md` otherwise." as the skim "frictions Ousterhout symptoms deferred costs recorded later triage. issues vault project`tracker one-liners `docs/frictions. md` otherwise." It then searched for `docs/frictions.md`, found none, and created one in Concept, a vault project (`6b514ef9`). Later Opus workers read the rule in full and still appended to the file that now existed. Another verifier that day (`01a0ccc1…`, line 14) got "issues in vault project (`tracker one-liners in `docs/frictions. md`.", with "otherwise" gone.

The skim was the model's first reading, and the full text reached it later inside other output (line 839); which of the two misled it is not established. The rule itself is now condition-first, without a trailing "otherwise".

Moved from `docs/frictions.md` (origin: exec reading review, run_69a467196c6b, 2026-09-22): "Foveated ingress now supports explicit reading focus and extractive skims. One live source read distinguished orientation from editing, but single-excerpt gist quality and fidelity thresholds remain uncalibrated; full-input replay records also increase local session storage. [Encounter and replay](../research/ingress-foveation-2026-09-22.md)."

September 26 mitigation: `ab skill` now protects activated instructions with the same exact-output mechanism used by other bash evidence; previously it printed filterable text even though exec activation was protected. Shared worker guidance names activation and exact reference reads. Ten focused tests pass. The current fidelity judge retained relevant instruction passages in a five-chunk live probe; a proposed extra rule made no difference, so the judge and compressor were left unchanged. Direct 75% compression reproduced the historical damage. [Probe, receipts and scope](../research/instruction-skimming-2026-09-26.md).

Open: general skim fidelity/task-accuracy calibration and replay storage cost. Ordinary instruction-source reads can still be skimmed; activation and explicit raw reference reads are the protected paths, not a filename-based exemption. Worker adoption has not been measured. Keeping particular function words is not established as sufficient to preserve logic; the direct replay retained “otherwise” while damaging the relationship it qualified.
