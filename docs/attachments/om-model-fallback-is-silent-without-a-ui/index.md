# OM model fallback: implementation first use

Independent acceptance encounter: [driver log](drive.md).

Runtime change: `955f4dbb`.

A missing configured OM model now produces a warning naming the configured model and the selected session model. Interactive contexts receive the existing UI warning; contexts without a usable UI write the warning to stderr. No model-selection policy changed. Worker and condenser replay entry points already require their exact selected model and reject a catalog miss.

## Setup and entry point

Run from a checkout with the project's dependencies installed:

```sh
bun docs/attachments/om-model-fallback-is-silent-without-a-ui/first-use.ts headless
```

This is an offline library fixture, with a synthetic session model and registry/auth response. It sends no model requests and needs no credentials. The script prints the selected model on stdout; the runtime writes its headless warning directly to stderr. It does not intercept the warning.

Additional modes:

```sh
bun docs/attachments/om-model-fallback-is-silent-without-a-ui/first-use.ts ui
bun docs/attachments/om-model-fallback-is-silent-without-a-ui/first-use.ts configured
bun docs/attachments/om-model-fallback-is-silent-without-a-ui/first-use.ts replay
bun docs/attachments/om-model-fallback-is-silent-without-a-ui/first-use.ts condenser
```

`ui` prints notifications instead of rendering a terminal UI. `configured` makes the requested model available in the fixture registry. `replay` and `condenser` launch the real replay CLI with a synthetic frozen snapshot, an isolated temporary `PI_CODING_AGENT_DIR`, and an intentionally absent provider/model. Their expected exit status is 1; they remove their scratch directories in `finally`. They do not read the user's auth or session files.

## Observed

- Headless: stderr contained `Observational memory: configured model fixture-om-missing/no-such-model not found, using session model fixture-session/foreground`; stdout identified `fixture-session/foreground` as selected.
- UI fixture: one notification at level `warning`, with the same configured and selected identities; no headless warning.
- Available configured model: selected `fixture-om-missing/no-such-model` with no warning.
- Worker and condenser replays: both exited 1 with `Required exact replay model is not in Pi's catalog: fixture-om-missing/no-such-model`, before auth or worker execution. No replay behavior change was necessary.

Existing regressions: `bun test extensions/context/om extensions/context/notes.test.ts extensions/context/optmem/build.test.ts` — 18 passed, 0 failed. `bun run typecheck` passed. No commit hook is installed in this checkout.

The independent driver/reviewer still owns acceptance and the ticket-authorized headless regression test. This first-use launcher is outside the test suite.

## Review

- The driver's "A regression test covers the headless case" story was unobservable to it; the diff had no test. Added `extensions/context/om/runtime.test.ts` (headless stderr warning naming configured and used models; UI notify once with no stderr; available configured model, no warning). It fails on the base `runtime.ts` (headless case) and passes at head: `bun test extensions/context/om/runtime.test.ts`, 3 pass. Story now held.
- Replays already fail closed on an absent exact model (`replay-workers.ts` "Required exact replay model is not in Pi's catalog"); driver exit-1 observations stand, no change needed.
- The unrelated `memory-as-a-log-with-pluggable-projections.md` tracker edit in the range comes from the merged base, not this change.
