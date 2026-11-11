---
stage: "goal"
assignee: "human"
author: "session:hermes-concept-strategy-2026-11-11"
---
idea: "I think we should change my optmem to have named profiles, rather than being per session. originally i intended to just keep optmem sessions around for a long time, but i think this would be a better ux. and then each concept agent could be an optmem profile. i don't see much point to using this kind of logarithmic memory system for a short session." Then, having worked out what kind of creature the mechanics imply: "If what we want is one 'creature' with the capacity for simultaneous manifestations, because simultaneous manifestations is advantageous in many ways over not being able to manifest simultaneously, so we see this as a 'capability' of the creature", and "let's start on revising my pi optmem to a realization of this, then. It seems to deserve a rename though. Maybe 'hydra'?" (maintainer, 2026-11-11, Hermes concept-strategy desktop session `20261111_184900_7d1d9e`).

goal: [optmem](../../extensions/context/optmem/index.ts)'s successor is a named life that any number of sessions are attached to at once. A life is one agent's chat that never ends (the word is the Connectome port's, `extensions/connectome/README.md` at `b40cdecd^`); a manifestation is a session attached to it. Optmem has only a past. A creature that can be in several places also needs a present: where it is now and what each of it holds.

The situation it's for: mlegls is in a bb thread with Concept Engineering about one issue while a second thread of it shapes another and a scheduled run of it fires. Each knows the others are running and what they hold. What one finished, the others remember from their next run on, marked with where it happened. A message to Concept Engineering reaches it while it is busy. Today each of those is a gap in Hermes, where the four Concept agents live: a busy bot can't be messaged, a second session on a profile shares none of the first's history, and two writers on one profile's memory are warned against.

Out: the agent's soul and agent-scoped skills ("agent-scoped skills could also be implemented as a pi extension or bb plugin"), which are files and separable. [notes](../../extensions/context/notes.ts) stays as it is, facts shared by every agent in a project.

## proposed shape

Proposed by concept-strategy in that session. The maintainer asked for a realization of the creature and has not ruled on these mechanics.

- **log.** A life's messages are numbered in one append-only sequence in the [records store](../../lib/records/store.ts), each citing its session entry (`entry:<session>/<entry>`, [branch.ts](../../lib/records/branch.ts)). A manifestation appends its run when the run ends, and the run's older part when its boundary moves (the long-run case in `index.ts`). Positions are assigned inside the write, as upstream OptMem assigns ids inside its lock. So a run stays contiguous and manifestations interleave by run, not by message. Nodes are keyed by life, level and index, and are shared.
- **view.** One saved view per life, advanced at a run's start by whichever manifestation starts one and fixed for the run as now. Manifestations starting from the same view share its cache entry. A line shows which manifestation its messages came from.
- **present.** After the view, at run start: the other manifestations with a run in progress, where each is (its bb thread), since when, and what it says it holds. That last is one line a manifestation sets. Nothing enforces it; a second manifestation reads it before committing to the same thing.
- **kinds.** One for what a manifestation tells another, apart from `work`: no context given, no reply owed.
- **prompt.** "its latest word on a thing is the truth" ([prompt.md](../../extensions/context/optmem/prompt.md)) holds within a manifestation. Between runs that overlapped in time, order is only append order, and a conflict is reported, not resolved.
- **compactor.** On the life's own model with the turn's system prompt, since its lines are what the agent is at depth; [[projects/mlegls-pi/issues/om-memory-promotes-observer-judgments-over-the-users-own-statements]] is what another model writes there.
- **delegates.** A dispatched worker is a manifestation only when its task names the life, as the Connectome port did with `PI_CONNECTOME`.
- **names.** Project-scoped by default and `/name` for machine-wide, as the port did. The Concept agents work across repositories (this was filed from one working here), so theirs are machine-wide.

A life with one manifestation is today's optmem session, and no manifestation is the main one.

Later, each its own issue once this runs: a message addressed to the life lands in the manifestation holding its subject or opens one; a manifestation opens another of itself, and ending one says what the rest needs.

## holes

For the maintainer:

- **name.** `hydra` (maintainer) or `life` (concept-strategy: the unit is already called that, most of the time there is one manifestation, and the mythic hydra is the thing that can't be stopped). Either way a session isn't a "head", beside git's HEAD and the branch tips this code is full of.
- **does a life follow its name across models?** The port kept one life per model under a name. Recommended: one life per name, each node recording the model that wrote it, so a Concept agent keeps its life when its model changes.
- **per-session optmem.** Recommended: remove it. A session attaches to a name or uses OM, and an existing optmem session can be adopted by a name.
- **two machines.** The records store is local and bb runs threads on the MacBook and the Beelink, so a life lives on one machine until the store syncs. Recommended: Beelink only for the trial.
- **a Concept agent's past.** Whether its Hermes Bot Chat transcripts (`~/.hermes/profiles/<name>/state.db`) become the life's first messages, or it starts empty with its soul and skills.

For the trial to answer (Concept Engineering as a life on the Beelink):

- what counts as present: a run in progress, or any open bb thread.
- how much of a manifestation's own recent past stays whole when siblings' runs crowd the fine end of the view.
- what self-written lines cost. The Connectome trial measured memory writes at 126% of foreground spend on Opus (`docs/research/connectome-vs-om-2026-09-26.md` at `b40cdecd^`); optmem's compactor shares the turn's cache entry, so it may differ.

decisions:
- 2026-11-11: named lives replace per-session optmem, and each Concept agent is one (maintainer, quoted above).
- 2026-11-11: "the source session should be tracked at the 'raw' level as opposed to erased" (maintainer). Whether sessions are summarized together he called a matter of what feels natural to the agent as a self; concept-strategy's answer was together, with the source shown in the view.
- 2026-11-11: being in several places at once is a capability of the one creature, designed for and not tolerated (maintainer, quoted above).
