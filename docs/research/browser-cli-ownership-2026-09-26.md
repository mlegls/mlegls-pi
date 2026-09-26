# Browser CLI ownership — September 26

The reported tab switches and stale refs have different causes. No CLI patch is justified by the recovered evidence. Use its existing named sessions for worker ownership and fresh refs after actions; the shared worker instructions now say this, rather than only the verifier stance.

## Original receipts

Session UUIDs locate JSONL files under `~/.pi/agent/sessions/`; numbers below are physical lines.

- `01a0dcc8-f6a6-7570-bba7-c7e26ad127e4:171–183`: unqualified `chrome-devtools-axi open` targeted port 4408; the later snapshot showed port 4406. Subsequent calls remained unqualified, including `newpage`. This establishes a target mismatch but not which caller changed selection. No per-command session override appears in those invocations.
- `01a0dcb1-d69d-702e-a09c-daa09add44a1:156,170,176`: another worker used unqualified commands on 4406 during the same campaign. Its stale-ref report at 247–248 followed screenshot **and resize** at 242, not a screenshot-only experiment. The ref's generation was 1534; the refusal reported 1535.
- `01a0dcf8-6ddb-73fa-93ff-51003b6f9aee:250–255`: the named `gcg` session obtained generation 22, clicked that ref, waited and evaluated location, then clicked the same generation-22 ref again. The refusal reported current 24. That sequence does not isolate eval or wait as the invalidator. Earlier, line 109 chained fill and click using refs from the same old snapshot.

Installed `chrome-devtools-axi` 0.1.35 documents separate bridge/state per session but explicitly leaves connection mode and profile unchanged. Its `uid-freshness.js` observes DOM child, attribute and text mutations; any observed mutation or generation mismatch rejects the ref. Snapshot capture increments generation. The safety policy is conservative: a mutation elsewhere can invalidate a still-present control. Accepted workaround: fresh observation, or selector-based `run` for deterministic replay, not disabling freshness checks.

## Bounded live probe

Two unique named sessions, with inherited `CHROME_DEVTOOLS_AXI_*` connection settings removed for the probe only, opened different static pages served on loopback. No default session or existing project server was used.

| Encounter | Observed |
| --- | --- |
| Open Owner A and Owner B in separate named sessions | Later title reads remained A and B respectively |
| Snapshot, screenshot, click saved ref | Click succeeded |
| Snapshot, read-only eval, click saved ref | Click succeeded |
| Snapshot, wait 50 ms, click saved ref | Click succeeded |
| Fill plain input initially containing `old` | Value became `replacement`, not appended |
| Snapshot, mutate an unrelated span, click saved ref | `STALE_REF` |

Raw command results are retained at `docs/attachments/browser-cli-ownership-2026-09-26.json`. Both named bridges were stopped and the temporary HTTP server closed in cleanup. No controlled-input, resize-specific or highly dynamic-page reliability claim follows from this fixture. The original fill-at-caret observation remains unproven for its application context; no generic fill replacement was added.

There is no automatic bridge allocation or cleanup hook in the harness change. It delegates to the CLI's existing session feature and makes ownership apply to implementers as well as verifiers. Shared-browser endpoint assignment still requires an explicit owner.
