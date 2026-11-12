# Hermes import: implementation first use

Implemented in `extensions/context/life/import-hermes.ts`, from base `32a544841eff02d8f14ef6e4abb972debaf7cbf2`. This is the implementer's first-use check; independent driving follows.

## Reproduce

Run from the checkout under test, with Bun installed and the existing local Hermes profiles readable. No model credentials or running server are needed. The importer opens the source SQLite database read-only. Use a disposable records store, rather than the agent's actual life:

```sh
STORE="$(mktemp -d /tmp/hermes-import-first-use-XXXXXX)"
PI_BOARD_DIR="$STORE" bun extensions/context/life/import-hermes.ts concept-engineering
PI_BOARD_DIR="$STORE" bun extensions/context/life/import-hermes.ts concept-engineering
PI_BOARD_DIR="$STORE" bun -e 'import {lifeLog} from "./extensions/context/life/log.ts"; const ms=lifeLog("/concept-engineering").read(); console.log({messages:ms.length, contiguous:ms.every((m,i)=>m.pos===i), quizzes:ms.filter(m=>m.place.startsWith("Hermes oneshot:")).length});'
rm -rf "$STORE"
```

`--help` describes the CLI. `--dry-run` reports the source, destination life, sessions, rows, runs, converted message count, distinct display kinds and surviving context-wrapper rows without opening the destination. `--life /another-name` overrides the default life. The same command accepts `concept-strategy`, `concept-design` and `concept-gtm`.

## Observed on 2026-11-12

- Engineering: 9 sessions (including the empty ACP session), 244 original rows, 14 runs, 277 life messages. First import appended 277; repeat appended 0. Reading the isolated life returned 277 contiguous positions, including all 14 quiz messages.
- First stored source: `hermes:concept-engineering/20261108_221538_44a911/a29761d4d4ec40cc936b9d92905992b5#0`, kind `work`, date `2026-11-08T14:15:51.292Z`, model `claude-subscription-directsdk-experimental/claude-opus-5-5[1m]`.
- Dry-run Strategy: 23 included sessions, 7 excluded, 895 original rows, 65 runs, 1030 converted messages.
- Dry-run Design: 12 included sessions, 0 excluded, 500 original rows, 27 runs, 559 converted messages.
- Dry-run GTM: 12 included sessions, 3 excluded, 433 original rows, 28 runs, 535 converted messages.
- No surviving `[PRIOR CONTEXT` or `[CONTEXT COMPACTION` rows in any of those dry-runs.
- The extra `process_complete` display kind occurs in Strategy and Design. Its content is a background-process completion notification; it is classified as `work`. The ticket's kind list was expanded through the tracker to include it.
- `bun test extensions/context/life/log.test.ts lib/records`: 4 passed, 0 failed. `bun run typecheck`: passed.

Only disposable destination storage was used and removed afterwards. Actual lives were untouched. No pi session files, summary nodes, paid requests, servers or browser sessions were created. Zoom/date/recall and first-manifestation summarization are left to the independent driver, using the existing life surfaces.
