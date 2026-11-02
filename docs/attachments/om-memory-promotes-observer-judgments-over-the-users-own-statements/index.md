# OM user-authority repair: implementation setup

Current revision: `b2846567`. Nonvisual CLI/library journey; implementation self-check, not independent acceptance. Fresh exact-model worker and condenser replays are running on this revision. The prior trials below diagnose the remaining checks rather than certify the new revision.

## Required and prepared target

- Required: replay the recorded session's ledger through the changed reflector and condenser using `openai/gpt-6.1-terra`, with the recorded foreground context window of 1,000,000 tokens.
- Owned execution target: this ticket's worker checkout and a checkout-local output directory; the replay reads the source session and shared OM records but writes only its output directory. No foreground session, deployment, server or provider configuration is modified.
- Persona/auth: existing host Pi OpenAI credentials, through `ModelRuntime`; no credentials copied into artifacts. The host's OpenAI credential availability check succeeds. The required exact model is available through the host's dynamic `models-store.json` catalog (worker context 272,000 tokens). The initial absence report was a replay setup error: `refreshOnCreate:false` skipped disk cache restoration. The runner now awaits normal runtime creation against the host agent directory before reading its `ModelRegistry`.
- Seed: `/home/mlegls/.bb/pi-bridge-sessions/thr_78sspagtst.jsonl`, Session `01a196c7-c56e-7172-8426-f35d4ac07aff`, joined to its inherited/recovered OM records using `ledgerBranch`. The selected branch has 4,705 raw entries, 818 observations, 476 reflection records at the tip, 223 distinct historical reflector coverage boundaries, and 11 compactions. The tip is later than the ticket's final-compaction measurement.
- Prepared: frozen ledger input resolves a 20,000-token trigger and 15,000-token target. The first complete exact-model replay reached 223 boundaries and 116 final reflections / 9,272 tokens, but failed semantic inspection: it preserved an inferred acceptance rule by inventing an isolated-profile qualification. Prompt repair `35e4059e` rejects those observer allegations as evidence of a user rule. The second replay completed all 223 boundaries, reached 133 reflections / 10,163 tokens, and its rerendered 15:53 checkpoint preserves filming permission without a reflection prohibiting assistant acceptance. It still fails final-pool uniqueness: e.g. both the general rough-cut-first authorization and a more specific restatement remain. Revision `b2846567` makes the reflector consolidate duplicates/refinements below budget, retaining only evidence from current observations or explicitly replaced reflections. Replacement identities include lineage so A → B → A does not reuse a permanent tombstone. Fresh `om-real-ledger-replay-v3` and `om-condenser-replay-v3` are running against the same frozen input. The exported private snapshot is not committed; the command below reconstructs it from the named host seed.

## Runnable entry point

From the integrating checkout on this host:

```sh
bun extensions/context/om/session-ledger/replay-upstream.ts --workers /home/mlegls/.bb/pi-bridge-sessions/thr_78sspagtst.jsonl .wm/om-replay-v3
```

The script fails closed rather than substituting the foreground model. The same command runs/resumes the replay using the host's restored dynamic catalog. If the maintainer chooses another model, pass its exact `provider/model` as the last argument and use a fresh output directory. Completed reflector boundaries are checkpointed; changed input/model/prompts require a fresh directory. A generated `input.json` can replace the session path to resume against the frozen ledger rather than rereading the shared store.

Artifacts contain private session memory; keep them out of git. Select redacted evidence into this packet. `metrics.json` reports all compactions and the final pool's ceiling status; `summary-04f31583.md` is the 2026-10-30 15:53Z summary; `pool-aece8a37.json` is the pool at the final compaction. `ledger.json` includes generated reflections and supersession tombstones. The replay retains the historical observation/dropper schedule, replaces historical reflection writes, and runs the condenser on the changed budget; it does not rerun the observer. Input SHA-256 printed by setup: `4449503f5a26c2128e0daa769810f8c1d3f61179c3dca8e199a3012db9ddb3a7`.

Direct condenser reproduction (same source, only the recorded last-compaction pool):

```sh
bun extensions/context/om/session-ledger/replay-upstream.ts --condenser .wm/om-replay-v3/input.json .wm/om-condenser-replay-v3
```

This additional mode isolates condensation: the end-to-end replay's cleaner reflector pool may never reach 20,000 tokens. The recorded pool does. A first condenser trial reached 66 reflections / 7,065 tokens but stopped before removing near-duplicates. Revision `252c417f` adds a final full-pool duplicate sweep after reaching the size target; the completed 58-record trial below used that revision. The new revision is being retried separately.

## Observations

| Claim/action | Observed result | Limit |
| --- | --- | --- |
| Exact required model preflight and first use | Restored host registry selects `openai/gpt-6.1-terra`, 272,000 worker context; both replay modes make live requests with that exact model | Recorded foreground budget remains 1,000,000 tokens. Full repaired replay pending. |
| Condense the recorded over-budget pool | Compaction `aece8a37`: 465 reflections / 44,281 tokens become 58 reflections / 5,752 tokens, below the 20,000 ceiling | Live model, frozen input; not a migration of the foreground session. |
| Merge the reported near-duplicate families | Direct condenser output contains one worktree authorization, one capture-first/review-afterward authorization, and one nested-propose-schema repair record | Manual review of the 58 output records; this does not establish the end-to-end replay's final-pool uniqueness. |
| Clean legacy judgments using only old reflections | Direct condenser still retains an inferred real-profile restriction and alleged past violations beside filming permission | The direct mode lacks observation text, so it does not establish semantic grounding. The end-to-end reflector replay, which receives observations, is the required authority check. |
| Existing regression tests covering config, store, rendering, reflection ranking | 10 passed, 0 failed, 40 assertions | One existing budget expectation now asserts the absolute ceiling rather than merely growth with window size. No permanent tests added. |
| `bun run typecheck` | Passed on the implementation/replay code | No live provider behavior established. |
| Temporary synthetic reflector/tool and records-store diagnostic | Existing correct fact reused without a duplicate; conflicting id tombstoned; replacement id returned by recall after store round-trip; unknown superseded id rejected | Injected tool proposal, not model judgment. Temporary diagnostic is not a maintained acceptance test. |
| Supersession visible before a full observation fold | Replacement and tombstone immediately change the compaction reflection projection below the observation threshold (`c06fe795`); second replay summaries rerendered successfully with cached model decisions | The rerender makes no new model calls. |
| Duplicate replacement and identity diagnostic at `b2846567` | Retired source ids are inherited only through actual replacements; unscoped and unknown support is rejected; A → B → A leaves the reasserted fact active despite the original A tombstone | Synthetic tool proposal, not live model judgment. |
| 10-30 15:53 summary contains filming permission with no contradictory filming-profile prohibition | Held in second replay: reflection `d9c646e55b45` preserves the filming-profile permission and no reflection contains the never-accept rule | Final revision's fresh replay remains pending. Historical observer allegations remain because this replay does not rerun the observer. |
| Final pool below ceiling with one reflection per durable fact | Failed in second replay despite 133 reflections / 10,163 tokens: the rough-cut authorization is repeated, and completed fixes coexist with their earlier implementation status | Fresh `b2846567` replay and semantic inspection pending; token counts alone do not establish distinct durable meaning. |

[[projects/mlegls-pi/issues/om-configured-terra-model-is-absent-from-pi-catalog]] is closed as a misdiagnosis: the model is present via `models-store.json`; the runner's cache initialization was repaired in `09e97041`. No alternate model, raw session output, credential value, browser or resident server was used.
