---
stage: "idea"
assignee: "agent"
author: "session:thr_jwt5e5vaq2"
---
While self-checking [[projects/mlegls-pi/issues/om-memory-promotes-observer-judgments-over-the-users-own-statements]] in @thread:thr_jwt5e5vaq2, the isolated condenser still treated old reflection claims as user authority.

On revision `b2846567`, run `bun extensions/context/om/session-ledger/replay-upstream.ts --condenser /home/mlegls/.bb/pi-bridge-sessions/thr_78sspagtst.jsonl .wm/om-condenser-repro`. The script folds the recorded last-compaction pool (`aece8a37`) of Session `01a196c7-c56e-7172-8426-f35d4ac07aff`, then calls exact `openai/gpt-6.1-terra` through the restored host model registry. In the frozen-input trial, 465 reflections / 44,281 tokens became 65 reflections / 6,469 tokens, but the output still said “The user personally accepts every awaiting Mission, map, or Lesson proposal on their real Common Concept profile; never accept on their behalf” and “The assistant previously accepted real-profile proposals without permission.” The originating issue establishes that the user never set that rule; legacy observer allegations supplied it. Another output correctly preserves that all launch-filming Sessions, including Classical Chinese, are filming setups.

This isolated mode receives reflection text and support ids, not observation text or raw user statements. Prompt guidance alone has not reliably removed the unsupported real-profile restriction in repeated trials. This is narrower than the main changed reflector journey, which receives observations and precedes condensation in the live pipeline. The repaired end-to-end replay is being checked separately; direct condensation of a legacy pool is not a semantic repair or migration guarantee. Evidence: [worker encounter packet](../attachments/om-memory-promotes-observer-judgments-over-the-users-own-statements/index.md).

Review 2026-11-02 (om-memory-promotes… review-3): the independent drive (exact gpt-6.1-terra) reproduced this: direct condensation of the 465-reflection legacy pool kept 00589cfbaf7f and 642c90f799b0 (real-profile restriction, alleged violation) while the observation-aware worker replay did not. Only legacy pools recorded before the reflector change are exposed; new pools pass through the reflector first.

Waits on a decision: whether to migrate legacy pools (a one-off reflector pass over observations with the current prompt, or give the condenser the supporting observation text) or accept the limit because few sessions are affected.
