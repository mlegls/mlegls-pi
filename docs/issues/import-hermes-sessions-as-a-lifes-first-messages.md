---
stage: "done"
assignee: "agent:auto-routine"
author: "session:hermes-concept-strategy-2026-11-11"
priority: 2
---
idea: asked whether a Concept agent's "Hermes Bot Chat history becomes the life's first messages, or it starts empty with its soul and skills", the maintainer answered "import" (2026-11-11, Hermes concept-strategy desktop session `20261111_184900_7d1d9e`). Earlier in that session: "i think the 4 concept agents especially value continuity".

goal: a Concept agent's Hermes sessions become the first messages of its life ([[projects/mlegls-pi/issues/one-life-for-a-named-agent-across-simultaneous-sessions]]), so the life begins with what the agent already lived and not at the move. Concept Engineering first, for [[projects/mlegls-pi/issues/concept-engineering-runs-as-a-life-on-the-beelink]]; concept-strategy, concept-design and concept-gtm by the same command.

The source is `~/.hermes/profiles/<name>/state.db` (SQLite, opened read-only): `sessions` (id, source, title, model, started_at, parent_session_id, model_config) and `messages` (session_id, role, content, tool_calls, tool_name, timestamp, finish_reason, display_kind, message_uid, active, compacted, _compressed_summary). Concept Engineering on 2026-11-12 has one Bot Chat (source `desktop`, 230 messages since 11-08), seven two-message `oneshot` sessions that quiz it on the company's terms, and one empty `acp` session.

## shape

`bun extensions/context/life/import-hermes.ts <profile> [--life /<name>] [--dry-run]` (life defaults to `/<profile>`, machine-wide, as the Concept agents' are). It writes the life's `life` message records directly, through the same append the life uses at a run's end, so the import has no pi session files and needs none: the log holds copies (the life's shape), and `zoom`, `date` and `recall` reach them as any other. `life.source` is `hermes:<profile>/<session id>/<message_uid>#<k>` (`k` is the stable zero-based component/page index within the original row, as for pi entries), `life.place` is `Hermes <source>: <title>`. Nodes are built by the first manifestation, which already says "summarizing N messages of history in the background".

Which rows, from what the data showed (concept-strategy and concept-engineering, 2026-11-12):

- One message per `message_uid`, from its earliest row (lowest id), whatever its `active`/`compacted`. A Hermes compaction re-inserts the turns it keeps as new rows sharing the uid, with tool outputs cut to a stub ("[terminal] ran …") and assistant text prefixed "[PRIOR CONTEXT — for reference only; …]", and deactivates the earlier ones; the earliest row is the original. That is what concept-strategy's 232 rows with `active = 0` and `compacted = 0` are: every one shares its uid with a later row. Order within a session is that row's id.
- `_compressed_summary = 1` rows are Hermes's summaries ("[CONTEXT COMPACTION — REFERENCE ONLY] …"): out.
- Sessions: every source but `subagent` and those whose `model_config` has `_delegate_from` (Hermes's own test for a delegate, in its `messages_fts_trigram` triggers). Those are workers, not the agent. `cron` sessions are in: a scheduled run is the agent.
- Kinds: assistant text is `agent`, each of its `tool_calls` a `tool` (name and arguments, as pi's), a `tool` row an `echo` (clipped as pi's), reasoning dropped. A `user` row is `user` except `display_kind` `model_switch`, `async_delegation_complete` or `internal_notification` or `process_complete` (background-process completion), and text starting "[Cronjob", "[System:" or "Message from ", which are `work`. The dry run prints each distinct `display_kind` and every surviving row starting "[PRIOR CONTEXT" or "[CONTEXT COMPACTION", so a kind this list misses shows before anything is written.
- Model: the session's `model`, switched at each `model_switch` row ("The active model for this chat has changed to <id> via provider <provider>"), recorded as `life.model` on each message after it.
- Runs: a session splits at each `user` row; runs from all sessions are appended in the order they ended (their last row's timestamp), as the life would have recorded them. The quizzes are in: they are its own answers, fourteen messages.

Importing again appends only messages whose `life.source` isn't in the life yet, as runs at its end, so Hermes is then one more place the agent was. Into a life that already has pi messages it still appends at the end: positions never move. The trial ([[projects/mlegls-pi/issues/concept-engineering-runs-as-a-life-on-the-beelink]]) holds what Hermes's copy does meanwhile.

## tasks

Use [lifeLog(id).append](../../extensions/context/life/log.ts) for persistence and its `clip`/`pages` conventions for message conversion. The append deduplicates each component by its full source; a Hermes assistant row can yield text and several tool calls, so each needs its own stable `#k`.

The existing [records store](../../lib/records/store.ts) supports an isolated destination with `PI_BOARD_DIR`, so the command can be driven against the real read-only Hermes profiles without importing into the actual life.

decisions:
- 2026-11-11: a Concept agent's Hermes past is imported (maintainer, quoted above).
- 2026-11-12: concept-strategy (Hermes) owns this project ([[projects/mlegls-pi/issues/one-life-for-a-named-agent-across-simultaneous-sessions]]), and its questions go there, not to the maintainer: "for this in particular, I think you can just own the project. I don't need to be concerned with the details." (maintainer)
- 2026-11-12: the import writes life records directly (the life's log holds copies), one per message_uid from its earliest row; runs in the order they ended; quizzes and cron sessions in, delegates out; re-import appends what's new (shaping, @thread:thr_zig6b69pjn).
- 2026-11-12: re-import stays, though the agents are moving into bb and the import becomes a one-time migration (the supervisor asked, @thread:thr_dfgkcug6jp). Skipping a message whose `life.source` is already in the life is what makes the command safe to run twice, in a log where nothing is ever removed; and the other three agents keep working in Hermes until their own move, as Concept Engineering would again if the trial ends the other way (concept-strategy, as owner).

## Result

done

The Hermes import holds on the final head; I made no repairs.

I checked the importer against the source rows for all four profiles. I wrote a separate computation straight from each `state.db` and compared its message sources with what the import stores:

| Profile | Messages |
|---|---|
| concept-engineering | 277/277 |
| concept-strategy | 1030/1030 |
| concept-design | 559/559 |
| concept-gtm | 535/535 |

Nothing was missing or extra in any profile, and re-import appended 0.

- **Compaction text:** no stored message contains compaction wrapper text.
- **Clipping:** the longest message is 30030 characters (the clip marker over 30000).
- **Occupied life:** I imported Engineering into a life that already held two pi messages. The pi prefix stayed identical and positions stayed contiguous, which the driver couldn't cover.
- **Retrieval and manifestation:** the life's builder consumes the mixed log in-process: the pi message and the short imported messages resolve to their own nodes, and 161 longer ones queue for the compactor. I did not run real-model summarization of the imported history, since it costs model calls. It uses the same builder as pi messages.
- **Tests:** `bun test extensions/context/life` passes (14 tests) and `bun run typecheck` is clean. The project declares no `test:affected` task, so I ran those directly.

I closed both of the driver's frictions through the tracker:
- **`hermes-import-drive-needs-life-retrieval-entry-point`:** closed as a caller error. `extensions/context/life/README.md`, section "First use", documents the real-pi recipe.
- **`tracker-outline-has-no-project-vault-note`:** closed as an accepted limitation. It reproduces from the main checkout too, because no vault note with this directory exists on the host, and `snapshot` and `tree` work in the meantime.

Some imported messages carry a bare model id (for example `claude-fable-5-2[1m]` or `gpt-6.1-sol`), because sessions with no model-switch row keep the raw `sessions.model`. I left that as the data has it.

```yaml
commit: cc3345fc
stories:
  - story: Engineering history imports into an isolated life, including fourteen quiz messages
    outcome: held
  - story: Repeat import appends zero messages
    outcome: held
  - story: Import into an occupied life preserves existing positions and supports --life
    outcome: held
  - story: Strategy, Design and GTM import through the same command
    outcome: held
  - story: Imported messages are reachable through zoom/date/recall and initial manifestation summarizes history
    outcome: held
  - story: Detailed row selection, model transitions, clipping and run ordering match every source row
    outcome: held
evidence:
  path: docs/attachments/import-hermes-sessions-as-a-lifes-first-messages/index.md
  visual: false
  shots: []
tests:
  - extensions/context/life/log.test.ts
  - extensions/context/life/build.test.ts
  - extensions/context/life/tree.test.ts
filed: []
settled:
  - hermes-import-drive-needs-life-retrieval-entry-point (closed)
  - tracker-outline-has-no-project-vault-note (closed)
caveats:
  - Real-model summarization of imported history was not run; the builder was checked in-process without a model.
  - Run ordering by end time follows from the sort in `import-hermes.ts` and was not checked separately from the source-set comparison.
  - Models without a model-switch row keep the raw `sessions.model`, so some ids lack a provider prefix.
  - No test-wall-time trades are introduced by this change.
```

Evidence: [docs/attachments/import-hermes-sessions-as-a-lifes-first-messages/index.md](../attachments/import-hermes-sessions-as-a-lifes-first-messages/index.md)
