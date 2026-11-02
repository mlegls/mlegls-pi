# OM user-authority repair: implementation setup

Implementation revision: `09e97041` (after `ba7a3024` and `1d69dad4`); this packet records setup and mechanism checks, **not live-model acceptance**. Nonvisual CLI/library journey.

## Required and prepared target

- Required: replay the recorded session's ledger through the changed reflector and condenser using `openai/gpt-6.1-terra`, with the recorded foreground context window of 1,000,000 tokens.
- Owned execution target: this ticket's worker checkout and a checkout-local output directory; the replay reads the source session and shared OM records but writes only its output directory. No foreground session, deployment, server or provider configuration is modified.
- Persona/auth: existing host Pi OpenAI credentials, through `ModelRuntime`; no credentials copied into artifacts. The host's OpenAI credential availability check succeeds. The required exact model is available through the host's dynamic `models-store.json` catalog (worker context 272,000 tokens). The initial absence report was a replay setup error: `refreshOnCreate:false` skipped disk cache restoration. The runner now awaits normal runtime creation against the host agent directory before reading its `ModelRegistry`.
- Seed: `/home/mlegls/.bb/pi-bridge-sessions/thr_78sspagtst.jsonl`, Session `01a196c7-c56e-7172-8426-f35d4ac07aff`, joined to its inherited/recovered OM records using `ledgerBranch`. The selected branch has 4,705 raw entries, 818 observations, 476 reflection records at the tip, 223 distinct historical reflector coverage boundaries, and 11 compactions. The tip is later than the ticket's final-compaction measurement.
- Prepared: the command below was opened and exported its frozen ledger input successfully, resolving a 20,000-token trigger and 15,000-token target. After correcting runtime catalog restoration, the exact model passed preflight and completed its first two historical reflector boundaries. The full replay is running as managed process `om-real-ledger-replay`; semantic acceptance remains pending. The exported private snapshot is not committed; rerunning the committed command reconstructs it from the named host seed.

## Runnable entry point

From the integrating checkout on this host:

```sh
bun extensions/context/om/session-ledger/replay-upstream.ts --workers /home/mlegls/.bb/pi-bridge-sessions/thr_78sspagtst.jsonl .wm/om-replay
```

The script fails closed rather than substituting the foreground model. The same command runs/resumes the replay using the host's restored dynamic catalog. If the maintainer chooses another model, pass its exact `provider/model` as the last argument and use a fresh output directory. Completed reflector boundaries are checkpointed; changed input/model/prompts require a fresh directory. A generated `input.json` can replace the session path to resume against the frozen ledger rather than rereading the shared store.

Artifacts contain private session memory; keep them out of git. Select redacted evidence into this packet. `metrics.json` reports all compactions and the final pool's ceiling status; `summary-04f31583.md` is the 2026-10-30 15:53Z summary; `pool-aece8a37.json` is the pool at the final compaction. `ledger.json` includes generated reflections and supersession tombstones. The replay retains the historical observation/dropper schedule, replaces historical reflection writes, and runs the condenser on the changed budget; it does not rerun the observer. Input SHA-256 printed by setup: `4449503f5a26c2128e0daa769810f8c1d3f61179c3dca8e199a3012db9ddb3a7`.

## Observations

| Claim/action | Observed result | Limit |
| --- | --- | --- |
| Exact required model preflight and first use | Initial runner cache-loading error corrected; readiness reports `openai/gpt-6.1-terra`, host agent dir, 272,000 worker context; first two reflector boundaries completed | Full semantic replay pending. |
| Existing regression tests covering config, store, rendering, reflection ranking | 10 passed, 0 failed, 40 assertions | One existing budget expectation now asserts the absolute ceiling rather than merely growth with window size. No permanent tests added. |
| `bun run typecheck` | Passed on the implementation/replay code | No live provider behavior established. |
| Temporary synthetic reflector/tool and records-store diagnostic | Existing correct fact reused without a duplicate; conflicting id tombstoned; replacement id returned by recall after store round-trip; unknown superseded id rejected | Injected tool proposal, not model judgment. Temporary diagnostic is not a maintained acceptance test. |
| 10-30 15:53 summary contains filming permission with no contradictory filming-profile prohibition | Unobservable | Await live replay. |
| Final pool below ceiling with one reflection per durable fact | Unobservable | Await live replay and semantic inspection; token counts alone do not establish distinct durable meaning. |

[[projects/mlegls-pi/issues/om-configured-terra-model-is-absent-from-pi-catalog]] is closed as a misdiagnosis: the model is present via `models-store.json`; the runner's cache initialization was repaired in `09e97041`. No alternate model, raw session output, credential value, browser or resident server was used.
