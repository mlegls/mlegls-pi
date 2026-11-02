# OM user-authority repair: implementation encounter

Tested code: `b2846567`, based on `f4a986c5`. Nonvisual CLI/library journey. All runs below are implementation self-checks, not independent acceptance; the parent owns verification and integration.

```text
observer: user statement ≠ assistant framing or observer judgment
reflector: add → reconcile/merge + replacement-linked tombstone
pool: min(window-derived share, 20,000); target 75%; final duplicate sweep
projection/recall: show replacements promptly; keep superseded sources recallable
```

## Setup and reproduction

- Required and used: exact `openai/gpt-6.1-terra`, restored through the host's live-session `ModelRuntime` / `ModelRegistry` and `~/.pi/agent/{auth,models,models-store}.json`. Worker model context is 272,000 tokens; the recorded foreground budget remains 1,000,000. No model substitution or provider configuration change.
- Owned target: this ticket's worker checkout and checkout-local output directories. Replay reads the source session and shared OM store but never writes to them. No deployment or server is required. Existing host OpenAI credentials are used without copying their values into artifacts.
- Seed: `/home/mlegls/.bb/pi-bridge-sessions/thr_78sspagtst.jsonl`, Session `01a196c7-c56e-7172-8426-f35d4ac07aff`, joined to inherited/recovered OM records with `ledgerBranch`. The selected branch has 4,705 raw entries, 818 observations, 476 reflection records at the tip, 223 distinct reflector coverage boundaries and 11 compactions. The tip is later than the ticket's final-compaction measurement.
- Frozen-input SHA-256: `4449503f5a26c2128e0daa769810f8c1d3f61179c3dca8e199a3012db9ddb3a7`. The worker's private snapshot is `.wm/om-replay-v3/input.json`; it is not committed. The source command below reconstructs it on this host.

From the integrating checkout:

```sh
bun extensions/context/om/session-ledger/replay-upstream.ts --workers /home/mlegls/.bb/pi-bridge-sessions/thr_78sspagtst.jsonl .wm/om-replay-v3
bun extensions/context/om/session-ledger/replay-upstream.ts --condenser .wm/om-replay-v3/input.json .wm/om-condenser-replay-v3
```

The worker replay retains the historical observation/dropper schedule, replaces reflection writes, and invokes the condenser on the changed budget; it does not rerun the observer. The direct condenser mode isolates the recorded last-compaction pool, because the cleaner worker replay never reaches the new trigger. Both modes fail closed on an unavailable exact model or provider errors. Completed worker boundaries are checkpointed; the same command resumes them and regenerates summaries without repeating successful model calls. Changed input/model/prompts require a fresh directory.

Artifacts contain private session memory; keep them out of git. Inspect `metrics.json`, `summary-04f31583.md` (2026-10-30 15:53Z), `pool-aece8a37.json` / `summary-aece8a37.md` (last compaction), and `ledger.json` (tip and supersession records). The condenser directory contains `condensed-pool.json` and `metrics.json`. Selected redacted results are below rather than raw transcripts.

## Evidence

**Before:** the recorded last-compaction pool holds 465 reflections / 44,281 tokens by this checkout's estimator, including repeated acceptance prohibitions and duplicate worktree/capture/fix records. Its large-window trigger allowed it to escape condensation.

**After:** exact-model replay completes all 223 boundaries. The last compaction has 101 reflections / 9,148 tokens; the later tip has 103 / 9,270. The direct condenser reduces the original 465 / 44,281 pool to 65 / 6,469. Both are below the 20,000-token ceiling and 15,000-token target.

| Required claim/action | Observed result | Scope of check |
| --- | --- | --- |
| Observer attributes the user's permission rather than the assistant's framing | A separate live `runObserver` call on original assistant entry `828f70fd` and user entry `168371c4` emits `a64ac131eeef`: “User authorized the assistant to accept map proposals … and stated the profile is just for filming, so the assistant does not have to think of it as theirs.” It cites both entries and emits no unsupported violation judgment | Exact required model, real source entries, empty prior-memory lists; not a full observer replay |
| 10-30 15:53 summary preserves filming permission without a conflicting never-accept reflection | Held. Reflection `37374bb32b8e`: “For made-up launch-filming Missions, the user authorizes the assistant to accept map proposals and says the filming profile is just for recording, not their personal profile.” None of the 38 rendered reflections asserts the never-accept rule | Reviewed the rendered reflection section; old observer allegations remain in observations because those historical records are not regenerated |
| New user framing supersedes conflicts and remains recallable | Tip reflection `da33de14fbc8` preserves that all filming-account Sessions, including Classical Chinese, are filming setups. The generated ledger has 98 replacement-linked supersession records; recalling a superseded id returns its old record, sources and replacement link | Actual generated ledger and recall library; no foreground session migration |
| One active reflection per durable fact | Held on manual review of the final-compaction and tip pools. The worktree authorization, capture-first authorization, nested-propose repair, rough-cut-first authorization and filming permission each have one canonical record; the tip has no exact-content duplicates | Related asset inventories and constraints may share context; counts alone are not the semantic check |
| Condenser runs for a large-window pool and merges near-duplicates | Direct trial: 465 / 44,281 → 65 / 6,469; one worktree authorization, one capture-first authorization and one nested-propose repair record. Its below-target sweep completes before returning | Live model on the frozen recorded pool; direct condensation alone is not semantic regrounding of old memory |
| Existing affected regression tests | 10 passed, 0 failed, 40 assertions across config, store, summary rendering and reflection ranking | One existing budget expectation now asserts the absolute ceiling; no permanent tests added |
| `bun run typecheck` | Passed on `b2846567` | No code changes after that revision |
| Temporary mechanism diagnostics | Exact correct fact reused; unknown superseded ids rejected; supersession survives store/recall round trip and projects below the observation-fold threshold; duplicate merges inherit only replaced evidence; A → B → A remains active rather than reusing a permanent tombstone | Injected tool proposals, separate from the live-model checks above |

Earlier trials exposed two in-contract failures before this final run: an invented isolated-profile qualification, then near-duplicates below the size trigger. The final prompts reject observer allegations as user authority; the reflector now consolidates duplicates/refinements on every run, with evidence inherited only from explicitly replaced records. The condenser also performs a final duplicate sweep below target. Replacement identities include lineage to preserve later reassertions despite permanent tombstones.

Regression command:

```sh
bun run typecheck
bun test extensions/context/om/config.test.ts extensions/context/om/session-ledger/store.test.ts extensions/context/om/session-ledger/render-summary.test.ts extensions/context/om/hooks/rank-reflections.test.ts
```

## Limits and owned friction

- Direct condensation of legacy reflections still retains an unsupported real-profile restriction and alleged past violations beside filming permission. It receives reflection text/support ids, not observation text. This limit is owned by [[projects/mlegls-pi/issues/condenser-retains-unsupported-rules-when-only-legacy-reflections-are-available]]; it is not presented as a semantic repair/migration guarantee. The live pipeline runs the observation-aware reflector first, and the required end-to-end replay above does not retain that rule.
- [[projects/mlegls-pi/issues/om-configured-terra-model-is-absent-from-pi-catalog]] was closed as a misdiagnosis: the runner initially skipped dynamic disk-catalog restoration; `09e97041` fixed initialization. The model was available through `models-store.json` throughout.
- All worker-owned trial/check processes have exited. No server, browser, deployment, raw session output or credential value is committed or left running.

## Danger

**Door:** code is reversible; new supersession writes are durable tombstones, with old records and replacement links retained for recall. Replay itself changes no live memory.

**Blast radius:** memory. Budget resolution, reflection consolidation, compaction projection and recall affect OM sessions generally. One ledger and one targeted observer encounter do not establish universal model judgment.
