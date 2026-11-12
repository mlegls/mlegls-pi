---
stage: "goal"
assignee: "agent"
author: "session:hermes-concept-strategy-2026-11-11"
blocked-by:
  - "[[projects/mlegls-pi/issues/one-life-for-a-named-agent-across-simultaneous-sessions]]"
---
idea: asked whether a Concept agent's "Hermes Bot Chat history becomes the life's first messages, or it starts empty with its soul and skills", the maintainer answered "import" (2026-11-11, Hermes concept-strategy desktop session `20261111_184900_7d1d9e`). Earlier in that session: "i think the 4 concept agents especially value continuity".

goal: a Concept agent's Hermes sessions become the first messages of its life ([[projects/mlegls-pi/issues/one-life-for-a-named-agent-across-simultaneous-sessions]]), so the life begins with what the agent already lived and not at the move. Concept Engineering first, for [[projects/mlegls-pi/issues/concept-engineering-runs-as-a-life-on-the-beelink]]; concept-strategy, concept-design and concept-gtm by the same command.

The source is `~/.hermes/profiles/<name>/state.db` (SQLite, opened read-only): `sessions` (id, source, title, model, started_at, parent_session_id) and `messages` (session_id, role, content, tool_calls, tool_name, timestamp, active, compacted, _compressed_summary). Concept Engineering on 2026-11-12 has one Bot Chat (source `desktop`, 230 messages since 11-08), seven two-message `oneshot` sessions that quiz it on the company's terms, and one empty `acp` session.

What that data asks of the import:

- `role = 'user'` isn't always the maintainer. The Bot Chat's user rows include a model-change notice, a cron job's output and a message from Concept Design; those are `work`.
- `sessions.model` is too coarse for the model each message records: the Bot Chat changed model midway, and the notice row is where that shows.
- A Hermes compaction leaves the rows it replaced in the table (`compacted = 1`) and flags its summaries (`_compressed_summary = 1`). The life takes the originals. concept-strategy also has 232 rows with `active = 0` and `compacted = 0`; what they are isn't known.
- `source = 'subagent'` sessions (concept-strategy has seven, each with a parent) are workers, not the agent.

holes, for whoever shapes this beside the life's spec:

- the life's log holds references to pi session entries. Either the import writes a pi session file per Hermes session, so the log, `zoom` and recall work unchanged, or the log takes foreign references. Recommended: session files.
- order. Recommended: runs in the order they ended, across sessions, as the life would have recorded them.
- the seven quizzes. Recommended: in; they are its own answers and fourteen messages.
- importing again after the agent has kept working in Hermes: only what is new, or once. The trial issue holds what Hermes's copy does meanwhile.

decisions:
- 2026-11-11: a Concept agent's Hermes past is imported (maintainer, quoted above).
