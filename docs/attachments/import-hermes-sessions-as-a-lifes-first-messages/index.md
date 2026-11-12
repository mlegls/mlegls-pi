docs/attachments/import-hermes-sessions-as-a-lifes-first-messages/index.md (15 lines)
# Independent CLI encounter

Revision: `6969eeabaedf954a2f00f144e420b469fe9cc055`. Nonvisual local Bun CLI; existing Concept profiles, no credentials or server. Source is the real read-only Hermes SQLite store. Destination will be a newly created, worker-owned `/tmp/hermes-drive-*` directory selected explicitly by `PI_BOARD_DIR`; actual lives are untouched.

## Predictions before opening the product

1. Engineering dry-run identifies the default `/concept-engineering` life, reports original rows, quizzes and display kinds without writing a destination.
2. Import into an empty isolated store yields the agent's Hermes past, including fourteen quiz messages; records have stable component sources, places, models and contiguous positions. The empty ACP session contributes no messages.
3. Running again appends zero and leaves positions unchanged. Importing into an already occupied life leaves its earlier records in place.
4. Strategy, Design and GTM work through the same command; delegates and compaction wrappers are excluded, and display-kind diagnostics make classification visible.
5. Imported history is available through the life log's public read surface. Existing zoom/date/recall and first-manifestation summarization require a discoverable runnable surface; I will look for its user-facing entry point rather than infer internals.

## Encounter

Actual owned destination: `/tmp/hermes-drive-7RG8vZ`, created empty by this worker. `PI_BOARD_DIR` was unset in the inherited environment; every product command explicitly selected this directory. `--help` completed, then Engineering dry-run completed with no destination files (`find` returned none). No services needed readiness checks.

| Journey | Action and observation | Outcome |
|---|---|---|
| Engineering migration | CLI import: 9 sessions, 244 original rows, 14 runs, 277 converted messages; appended 277. Public `lifeLog("/concept-engineering").read()` returned 277 contiguous positions, 277 unique sources and fourteen `Hermes oneshot:` messages. Kinds observed: work/user/tool/echo/agent. | held |
| Safe repeat | Same CLI command again: appended 0. | held |
| Append into occupied destination / override | Saved Engineering public-read result, imported Design with `--life /concept-engineering`: appended 559, total 836. Prefix JSON remained identical and all positions remained contiguous. Earlier pi-origin records specifically were not seeded. | held for occupied Hermes log; pi-specific case unobservable |
| Other Concept agents | Real imports appended Strategy 1030, Design 559, GTM 535 into their default isolated lives. Dry runs reported respectively 23/12/12 sessions and 7/0/3 excluded sessions. All surviving-context-marker lists were empty. | held |
| Retrieval and initial manifestation | Handoff exposes import and public log read, not a runnable manifestation or zoom/date/recall invocation. Docs search and `ab life --help` did not expose one. | unobservable |
| Detailed conversion contract | Counts/unique sources, places and kinds observed; earliest-row selection, every model transition, per-run ending order, clipping/pages, cron and delegate classification were not independently compared to source rows. | unobservable |

First observed source: `hermes:concept-engineering/20261108_221538_44a911/a29761d4d4ec40cc936b9d92905992b5#0`; place `Hermes desktop: Bot Chat`; model `claude-subscription-directsdk-experimental/claude-opus-5-5[1m]`. No private message text is retained in this packet.

## Expectations and frictions

Predictions 1, 2 (at aggregate/log level), 3 and 4 met. Prediction 5 met for public log reading, unmet for discoverability of retrieval/manifestation. The dry-run diagnostics clearly exposed Strategy `hidden` and `process_complete` display kinds; no surviving wrappers were reported. Counts establish the encountered output, not independent correctness of every selection rule.

Missing retrieval setup is owned by [[projects/mlegls-pi/issues/hermes-import-drive-needs-life-retrieval-entry-point]]. Tooling friction: tracker `outline` exited 1 with `no vault note has directory`; `snapshot --json` worked for issue search. Filed [[projects/mlegls-pi/issues/tracker-outline-has-no-project-vault-note]].

## Replayable checks

From the tested checkout, create `STORE=$(mktemp -d /tmp/hermes-drive-XXXXXX)` and explicitly prefix every invocation with `PI_BOARD_DIR="$STORE"`.

1. Run `bun extensions/context/life/import-hermes.ts concept-engineering --dry-run`; accept if diagnostics enumerate display kinds and context markers and `find "$STORE" -type f` remains empty.
2. Run the same command without dry-run twice; accept first append 277 and second append 0 for the encountered source snapshot. Use the handoff's public `lifeLog` read recipe to count records, unique sources, contiguous `pos`, and fourteen oneshot messages.
3. Serialize that read result, import `concept-design --life /concept-engineering`, then compare the old prefix byte-for-byte after JSON serialization; accept identical prefix and 559 new contiguous records for this snapshot.
4. Run the CLI on Strategy, Design and GTM; accept successful imports with no context-marker diagnostics and stable repeat counts. To establish detailed selection, compare real source rows read-only with stored sources, model transitions and runs; this was not performed in this encounter.
5. Using an isolated manifestation recipe (missing), invoke zoom/date/recall on an imported position and observe the original message, then observe initial background summarization. Accept only with actual returned content and completion evidence. This remains required evidence, not waived by this packet.

No browser/UI was rendered, source/diffs/tests/fixtures read, checks/tests run, model requests made, or actual lives changed. Temporary destination removed after observations; no servers or other processes were started.
# Review (appended after the driver's log)

Revision reviewed: `43f52bda` (importer unchanged from `6ddf7eae`; no repairs needed). Real read-only Hermes profiles, destination a throwaway `PI_BOARD_DIR` store, removed afterwards. Nonvisual.

## Independent check of the conversion contract (the driver's "unobservable" rows)

- Wrote a separate computation straight from each `state.db`: first row (lowest id) per `message_uid`, minus `_compressed_summary`, minus subagent / `_delegate_from` sessions; per row, one source per non-empty assistant text, each tool call, tool echo, user text, with 30k paging for text and calls. Compared its source set with the stored life for all four profiles: Engineering 277/277, Strategy 1030/1030, Design 559/559, GTM 535/535, zero missing, zero extra. Re-import of Strategy appended 0.
- No `[PRIOR CONTEXT` / `[CONTEXT COMPACTION` text in any stored message; longest message 30030 characters (clip marker over 30000). No uid is shared across sessions in any profile; no row lacks a uid.
- Model switch rows: `<provider>/<id>` from the "changed to X via provider Y" text, as recorded from the switch row on; sessions without one keep their raw `sessions.model` (so some messages carry `claude-fable-5-2[1m]` and others `claude-subscription-directsdk-experimental/claude-fable-5-2[1m]`; `gpt-6.1-sol` has no provider in the data).
- Occupied life with pi-origin records: appended two `lifeMessages` (pi source) then imported Engineering into the same life: the pi prefix JSON stayed identical, 279 total, positions contiguous.
- Retrieval/manifestation: the life's own `Chat` over that mixed log (no model; the `build.test.ts` recipe) resolves pi position 0 and the imported short messages to their own nodes, 161 longer ones queue for the compactor. Build, `zoom`, `date` read only `pos/kind/place/date/model/source/text`; the `summarizes` edge takes `source` as an opaque string, so Hermes sources need nothing further. Real-model summarization of the imported history was not run (costs model calls; the same builder serves pi messages). The documented real-pi recipe is `extensions/context/life/README.md` "First use".
- `bun test extensions/context/life` 14 pass; `bun run typecheck` clean. The project declares no `test:affected` task.

## Story outcomes on the final head

| Story | Outcome |
|---|---|
| Engineering imports, fourteen quiz messages | held |
| Repeat import appends zero | held |
| Occupied life (Hermes and pi records) keeps positions; `--life` | held |
| Strategy, Design, GTM through the same command | held |
| Imported messages reachable; builder consumes them | held (builder in-process; real summarization model call not run) |
| Row selection, models, clipping, paging match source | held |

## Frictions settled

- hermes-import-drive-needs-life-retrieval-entry-point: closed as caller error; README documents the recipe.
- tracker-outline-has-no-project-vault-note: closed as accepted limitation; reproduces from the main checkout (no vault note with this directory on the host), error names the cause, snapshot/tree work.

