# OM compaction render budget — implementation first use

Independent drive: [predictions, encounter, checks and limits](drive.md). The isolated budget/recall journeys held; live post-reload compaction remains unobserved.

Code revision: `052e1bb3` (base `9debeafc`). Nonvisual API journey; no screenshots. This is the implementer's first-use record, not independent acceptance.

## Prepared setup and entry point

Required final target: the existing concept supervisor, BB thread `thr_vetzcc74ex`, after this branch reaches the package checkout and that thread reloads. This worker did **not** integrate, reload, message, or compact the live thread.

Actually prepared: a checkout-owned, isolated local compaction fixture. No persona, credentials, provider calls, server, or external deployment. From any checkout containing this commit:

```sh
bun docs/attachments/om-reflections-grow-without-a-budget/first-use.ts
```

The command seeds 300 reflections and 240 observations in a temporary records store, invokes the registered `session_before_compact` handler with a 64k session window, prints its summary metrics, and removes the store. It was run successfully. This exercises the actual mechanism dispatcher, config loader, projection, renderer, and recall; the session context is a fixture, not a live Pi runtime. Override the explicit summary budget with `--budget 4000`; exercise unknown-window fallback with `--window 0`.

## Observed results

| Invocation | Resolved budget | Rendered estimated tokens | Reflections / observations rendered | Omitted / recallable |
| --- | ---: | ---: | ---: | ---: |
| Seeded, 64k window | 8,000 | 7,914 | 23 / 34 | 483 / 483 |
| Seeded, explicit 4k | 4,000 | 3,897 | 11 / 16 | 513 / 513 |
| Seeded, unknown window | 8,000 | 7,914 | 23 / 34 | 483 / 483 |

The default run ends with:

> (277 older reflections and 206 older observations omitted to fit the summary budget; they remain in the session memory ledger, see /om:view full.)

All 540 records remain in the projection details and ledger; every omitted id was found by recall. The renderer is ported verbatim from upstream `022da5e`; selection reserves observations half the usable budget, newest first, then allocates reflections the remainder and observations any unused space. Token counts use upstream's character-based estimate, not a model tokenizer. Condenser storage defaults are 60,000 / 40,000 tokens.

## Continued supervisor replay

Read-only replay entry point on the original host:

```sh
bun docs/attachments/om-reflections-grow-without-a-budget/first-use.ts \
  --session "$HOME/.bb/pi-bridge-sessions/thr_vetzcc74ex.jsonl" --window 1000000
```

This snapshots the existing SQLite store through a read-only connection into temporary storage and reconstructs the session's active branch. It never writes the source store or session file. The session's latest model-change entry `77b3e52b` names `anthropic/claude-opus-5-5`; `ModelRuntime.create().getModel("anthropic", "claude-opus-5-5")` reports a 1,000,000-token context window. The replay supplies that window explicitly; it does not inspect the running thread's model object.

Observed session header id `01a14e7f-a8d1-74b9-a802-0b9ba1d30c3f`; copied rewind parent path ends in `thr_vetzcc74ex_rewind_33542e95-b2bc-4cef-ae3f-b2867117321a.jsonl`. Replay cut: `ada258c9`. Ledger: 133 active reflections / 111 active observations. Projection: 131 reflections / 125 observations (the stable-prefix projection intentionally differs from the active ledger).

With a supplied 1M session window, the 125,000-token render cap keeps all projected records in 22,398 estimated tokens, including role reflection `d096ed8a3b51` ("persistent top-level `tend` supervisor"). With explicit `--budget 8000`, it renders 7,895 tokens, omits 168 records, and all 168 remain recallable; that older role reflection is then omitted too, consistent with upstream's newest-first allocation. This is not a pinning policy.

**Still required on the live target:** after integration and reload, observe the supervisor's next real compaction and confirm the role reflection is in its summary. The read-only replay is not evidence that a live reload or next compaction occurred. The live file's existing latest compaction `3c1eadae` at `2026-10-19T05:43:19.704Z` already carries that role, but predates this change and cannot establish this criterion.

## Regression checks

- `bun test extensions/context/om`: 4 passed, 0 failed.
- `bun test extensions/context/mechanism.test.ts`: 3 passed, 0 failed.
- `bunx tsc --noEmit`: passed.
- `git diff --check`: passed.

No new permanent tests were added; the existing config-mapping test follows the new setting. No running servers or external resources were left behind.
