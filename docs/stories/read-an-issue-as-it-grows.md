---
persona: maintainer
kind: process
---

## Read an issue as it grows

I open an issue at any stage and read it top-down like a note from a colleague: why it exists in the words it started with, what we decided to do, then how (a shape I can see at a glance), and at ticket stage the tasks if the shape didn't already say them. Nothing earlier gets replaced as it moves along; a later ruling changes the text it bears on and leaves one dated line. Workers read the same thing and are trusted to do what it means.

Source, 2026-10-25, @thread:thr_97xxb6d8ii: "i notice that the wording of many issues is quite opaque and defensive, as if the reader is quite untrusted and must be kept within strict bounds. rather i'd like issues to follow the style of /writing-skills, and be additive as they evolve from idea to tickets. ie, an idea is non-rigorous, with lots of verbatim original context. it's edited as it changes and becomes a goal, which in in a similar prose style to an idea but now \"determined\" for implementation. this goal stays as a section of the issue as it becomes a spec or ticket. a spec is in the style of /show-me, and \"shape\" level in the sense of Shape Up. then the spec stays, and tickets add tasks (or just change the status if the spec itself is clear enough on what's to be done), similar to the relation between designs and tasks in https://github.com/Fission-AI/OpenSpec. i used openspec before and generally liked it except the excess feeling of bureaucracy especially from when/then style specs, which i think is less fluid and more \"test-oriented\" than i like. but it feels like some \"enterprise larp\" (boundaries, gates...) is creeping back into our issues system"; "i also want to try getting rid of the \"compile\" related agents. i think the current frontier of models is good enough that that kind of work rarely makes sense anymore, and can be expressed directly in the relevant ticket where it does".

Implementation: the body format in the tracker's `references/issue-tracker-vault.md`; refine and handle roles in `agents/roles/`; `compile` and `fill` retired, `manager` the one refine stance.
