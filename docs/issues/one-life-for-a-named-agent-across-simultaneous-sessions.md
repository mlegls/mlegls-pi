---
stage: "goal"
assignee: "agent"
author: "session:hermes-concept-strategy-2026-11-11"
---
idea: "I think we should change my optmem to have named profiles, rather than being per session. originally i intended to just keep optmem sessions around for a long time, but i think this would be a better ux. and then each concept agent could be an optmem profile. i don't see much point to using this kind of logarithmic memory system for a short session." Then, having worked out what kind of creature the mechanics imply: "If what we want is one 'creature' with the capacity for simultaneous manifestations, because simultaneous manifestations is advantageous in many ways over not being able to manifest simultaneously, so we see this as a 'capability' of the creature", and "let's start on revising my pi optmem to a realization of this, then. It seems to deserve a rename though. Maybe 'hydra'?" (maintainer, 2026-11-11, Hermes concept-strategy desktop session `20261111_184900_7d1d9e`).

goal: [optmem](../../extensions/context/optmem/index.ts)'s successor is a named life that any number of sessions are attached to at once. A life is one agent's chat that never ends (the word is the Connectome port's, `extensions/connectome/README.md` at `b40cdecd^`); a manifestation is a session attached to it. Optmem has only a past. A creature that can be in several places also needs a present: where it is now and what each of it holds.

The situation it's for: mlegls is in a bb thread with Concept Engineering about one issue while a second thread of it shapes another and a scheduled run of it fires. Each knows the others are running and what they hold. What one finished, the others remember from their next run on, marked with where it happened. A message to Concept Engineering reaches it while it is busy. Today each of those is a gap in Hermes, where the four Concept agents live: a busy bot can't be messaged, a second session on a profile shares none of the first's history, and two writers on one profile's memory are warned against.

It runs beside [notes](../../extensions/context/notes.ts), which stays as it is: "the mechanic is a way to track 'experiential' history with the capacity for simultaneous manifestation. And you could use life and notes at the same time." The life is what one agent lived; notes are what any agent in the project wrote down.

Out: the agent's soul and agent-scoped skills ("agent-scoped skills could also be implemented as a pi extension or bb plugin"), which are files and separable.

## proposed shape

Proposed by concept-strategy in that session and accepted by the maintainer as the basis for the spec (decisions).

- **log.** A life's messages are numbered in one append-only sequence in the [records store](../../lib/records/store.ts), each a reference to its session entry (`entry:<session>/<entry>`, [branch.ts](../../lib/records/branch.ts)) that records the model its session was on. A node records the model that wrote it. A run is optmem's (`runStart` in `index.ts`): one message to the agent and its work on it, up to the reply that ends it. During a run a manifestation works from its own session file, as now. When the run ends, its messages get the next positions in the life together; when a long run's boundary moves (`tailBytes`), the part before the boundary gets them then. Positions are assigned inside the write, as upstream OptMem assigns ids inside its lock. So a run stays contiguous, a tool call stays with its result, and manifestations interleave by run, not by message. A run that never ended, because its session died, is appended when that session next starts. Nodes are keyed by life, level and index, and are shared.
- **context.** Each request is the life's view as of this run's start, then this run's messages whole, as optmem builds it. A thread has no history of its own beyond the run in progress: its earlier runs are in the view with everything else's.
- **view.** One saved view per life, advanced at a run's start by whichever manifestation starts one and fixed for the run as now. Manifestations starting from the same view share its cache entry. A line shows which manifestation its messages came from.
- **present.** After the view, at run start: the threads where the agent is working now (a run in progress), since when, and what it says it holds in each; then the threads that are open and idle, as places it can be reached. What it holds is one line a manifestation sets. Nothing enforces it; a second manifestation reads it before committing to the same thing.
- **looking.** `zoom` reaches messages appended since the run's view was fixed, and a sibling's run in progress can be read from its session file, so "what did you say there just now" has an answer without rebuilding the view.
- **kinds.** One for what a manifestation tells another, apart from `work`: no context given, no reply owed.
- **prompt.** "its latest word on a thing is the truth" ([prompt.md](../../extensions/context/optmem/prompt.md)) holds within a manifestation. Between runs that overlapped in time, order is only append order, and a conflict is reported, not resolved.
- **compactor.** On the life's own model with the turn's system prompt, since its lines are what the agent is at depth; [[projects/mlegls-pi/issues/om-memory-promotes-observer-judgments-over-the-users-own-statements]] is what another model writes there.
- **delegates.** A dispatched worker is a manifestation only when its task names the life, as the Connectome port did with `PI_CONNECTOME`.
- **names.** Project-scoped by default and `/name` for machine-wide, as the port did. The Concept agents work across repositories (this was filed from one working here), so theirs are machine-wide. A life is attached to its name alone: changing model keeps the life.

A life with one manifestation is today's optmem session, and no manifestation is the main one.

### speaking of it

Checked against anticipated sentences in the session above, and agreed by the maintainer.

- One subject, located by place and time: "you, in the import thread", "elsewhere", "yesterday in the pricing thread". The same grammar covers simultaneous and past, and the part gets no noun of its own in speech. "Thread" is the place (bb's word, the thing with a title); "session" stays pi's word in code; "manifestation" is for the one sentence that says a session is the agent itself and not a worker.
- "working in" a thread against "open" there; "holding" for what a manifestation has; "catch up" for reading what was appended elsewhere.
- Three verbs, three stores: it remembers (the life, no act needed), it notes (notes, shared with other agents), and "from now on" changes a skill or the soul. "Remember this" from the maintainer means don't let it fade, so the agent picks a note or a rule.
- Not used: "live" (the tracker's word for an unarchived issue), "main", "instance", "copy", "head", and "subagent" for anything but a worker.

A Concept agent's Hermes past becomes its life's first messages in [[projects/mlegls-pi/issues/import-hermes-sessions-as-a-lifes-first-messages]], and the trial is [[projects/mlegls-pi/issues/concept-engineering-runs-as-a-life-on-the-beelink]].

Later, each its own issue once this runs: a message addressed to the life lands in the manifestation holding its subject or opens one; a manifestation opens another of itself, and ending one says what the rest needs.

## holes

For the trial to answer ([[projects/mlegls-pi/issues/concept-engineering-runs-as-a-life-on-the-beelink]]):

- whether working-now and open-and-idle are the right two states of being present.
- how much of a manifestation's own recent past stays whole when siblings' runs crowd the fine end of the view. First thing to try: a thread's own last few runs stay whole after the view.
- what self-written lines cost. The Connectome trial measured memory writes at 126% of foreground spend on Opus (`docs/research/connectome-vs-om-2026-09-26.md` at `b40cdecd^`); optmem's compactor shares the turn's cache entry, so it may differ.

decisions:
- 2026-11-11: named lives replace per-session optmem, and each Concept agent is one (maintainer, quoted above).
- 2026-11-11: "the source session should be tracked at the 'raw' level as opposed to erased" (maintainer). Whether sessions are summarized together he called a matter of what feels natural to the agent as a self; concept-strategy's answer was together, with the source shown in the view.
- 2026-11-11: being in several places at once is a capability of the one creature, designed for and not tolerated (maintainer, quoted above).
- 2026-11-11: it is called `life`: "Life works well alongside notes, to explain what the writer is" (maintainer).
- 2026-11-11: per-session optmem is removed, nothing migrated: "agreed. i wasn't really using it" (maintainer). A session attaches to a name or uses OM.
- 2026-11-11: the trial is on the Beelink only (maintainer).
- 2026-11-11: a Concept agent's Hermes past is imported (maintainer).
- 2026-11-12: a life is attached to its name only, and the model is recorded on each message: "I'd usually keep profiles on the same model, but agreed that mechanically they should only be attached to the name. The model should also be recorded at the base level though, so it's easy to tell later." (maintainer).
- 2026-11-12: the way of speaking under "speaking of it": "Yes, this makes sense." (maintainer).
- 2026-11-12: the proposed shape is the basis for the spec. Asked for "one word from you on the mechanics as a whole", after the run and per-thread context were explained ("Okay, that makes sense"): "yes, you can do that too" (maintainer).
