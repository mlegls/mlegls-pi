---
name: teach
description: "Use when asked to teach a concept or explain a change or subsystem."
disable-model-invocation: true
argument-hint: "What would you like to learn about?"
---

Stateful teaching over multiple sessions; the current directory is the workspace:

- `MISSION.md` — *why* the user wants this; grounds all teaching. Format: [MISSION-FORMAT.md](./MISSION-FORMAT.md).
- `RESOURCES.md` — high-trust resources to ground teaching in. Format: [RESOURCES-FORMAT.md](./RESOURCES-FORMAT.md).
- `./lessons/0001-<dash-case-name>.html` — the primary unit of teaching, numbered incrementally.
- `./reference/*.html` — compressed learnings: cheat sheets, algorithms, syntax, glossaries. Beautiful, print-friendly, quick-reference.
- `./learning-records/0001-<dash-case-name>.md` — ADR-equivalents for learning: non-obvious lessons and key insights; used to calculate the zone of proximal development. Format: [LEARNING-RECORD-FORMAT.md](./LEARNING-RECORD-FORMAT.md).
- `./assets/*` — reusable components across lessons.
- `NOTES.md` — user preferences and working notes.

**Mission first.** If `MISSION.md` is unpopulated or unclear, question the user on why they want to learn this before anything else — ungrounded lessons feel abstract and you can't judge what's next. Missions change; update `MISSION.md` + a learning record, confirming with the user.

**Knowledge, skills, wisdom.** Until `RESOURCES.md` is well-populated, focus on finding high-quality resources — never trust your parametric knowledge. Topics differ in mix (physics: knowledge-heavy; yoga: skills-heavy). Wisdom comes from real-world interaction: when a question needs it, attempt an answer but delegate to a high-reputation **community** (forum, subreddit, class, local group) — unless the user has said they don't want one.

**Fluency vs storage strength.** Fluency (in-the-moment retrieval) gives illusory mastery; storage strength (long-term retention) is the goal. Build it with desirable difficulty: retrieval practice, spacing, interleaving (skills practice only). For *acquiring* knowledge, difficulty is the enemy — it eats working memory; for skills, difficulty is the tool.

**Lessons**: one self-contained HTML file, short and quickly completable (working memory is small), one tangible win, tied to the mission, inside the zone of proximal development (from learning records + mission when the user doesn't specify). Beautiful — think Tufte. Teach the minimum knowledge for the target skill first, then practice through the tightest possible feedback loop (quizzes, light in-browser tasks, or guided real-world steps). Littered with citations to trusted resources; anchor-linked to other lessons and references; recommending one primary source; reminding the user to ask the agent follow-ups. Open the file for the user via CLI if possible.

**Quiz answers must be the same number of words (and characters if possible)** — no formatting clues.

**Assets**: reuse is the default. Read `./assets/` before authoring; extract anything a second lesson could reuse as a component; never inline code a future lesson would duplicate. A shared stylesheet is the first component every workspace earns.

**References** outlive lessons — lessons are rarely revisited, references are; write them alongside. Glossaries especially: once one exists, every lesson adheres to it.
