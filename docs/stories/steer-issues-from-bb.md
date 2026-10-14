---
persona: maintainer
kind: process
---

## Steer issues from bb

I rarely edit issues by hand; agents write them. What I want from a tracker is to see where every tree stands and to put an agent on one from where I'm looking: hand a ready tree to a supervisor, or start a conversation about some issues to get them ready.

Issues page → pick the project → Tree (or Ready / Mine / Done / Archived) → open an issue to read its contract beside the list.

- A tree on the frontier → Supervise → a new supervisor, or one already running (the project's role holder, or one I started from here) → I land in that thread.
- A tree that isn't ready (still an idea or goal, blocked, claimed) can't be supervised: the reconciler expects specs and tickets. Refine starts a shaping session on it instead, told why it isn't ready.
- One issue → Discuss → bb's composer with the issue mentioned; I write the first message and pick the model. Several selected → the same with all of them; if they are all on the frontier, Supervise takes them together.
- In any composer, `#` finds an issue; the agent receives its path, state, subtree and contract.

The page follows the files: an agent's tracker write shows up without a refresh.

Source: "can we make a linear-like tracker plugin for bb based on the .md tracker convention described in my skills? the most important affordances would be to send an issue tree to a new/existing supervisor, and to start a session with selected issues mentioned, to start a refinement discussion"; "i pretty much never manually process issues anyway. it's for read + agent action"; "the reconciler expects specs/tickets, so there should at least be a session to change the labels. i think an override would break things"; "blank, and there should be a quicker way to start on one issue (tree) too"; "the multiselect should also have the supervise affordance if it's all spec/ticket".

Implementation: `bb/tracker/` (a bb plugin).
First use (2026-10-14, driven in bb's web app): tree, Ready, detail and the multi-select bar on mlegls-pi and concept; Discuss from two selected issues created a thread whose agent listed both issue paths from the mention context; `#thread-reg` in a project-less composer offered both matching issues; the Supervise dialog listed concept's role holder (thr_vetzcc74ex) beside New supervisor; `/skill:grill` as a spawned pi prompt expanded. Not yet driven: sending a tree to a supervisor, and Refine (both spawn the same way, with `/skill:supervise` and `/skill:shape`).
