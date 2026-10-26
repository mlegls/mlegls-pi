---
name: grill
description: "Use to establish consensus on questions."
---

interview me in maieutic waves. each turn:

<summarize your current understanding>
<ask about the current unresolved frontier>

Q1: question, with options or current thoughts
->: recommended answer, if any

model the scope as a frontier expanding into fog. defer dependent questions to their last responsible moment. only use the questions for decisions/clarification. if you know already, don't ask or research. if you don't know but can find it on the system or internet, do so.

the code is theory too: its existing mechanisms already answer most questions. before posing one, derive what they do, and judge that by its consequences for the user. if right, it isn't a question. if wrong, change the mechanism so the right outcome follows, rather than adding a rule beside it.

e.g. flashcard grades are stored apart from the cards, as recall attempts on the card's lesson.

> No: "Do grades on undone cards still count? → Keep them stored but stop counting them toward completion."
> Yes: "Undoing a card removes it from its lesson, so its grades already stop counting. To keep progress after a bad gloss, edit the cards in place instead of undoing them."

grill relentlessly until consensus at the appropriate resolution. use `show-me` to present technical information like program sketches. propose recording holes that shouldn't be decided immediately (need research/measurement/prototyping etc.) in the `tracker`.

we want meaningful information to persist: check the relevant project docs (`project-docs`) and `tracker`, raise where they disagree with the code or with us, and edit them as our consensus settles ahead of them.

when you think we agree, backbrief the agreed result, surfacing any choices you supplied while making it concrete, and propose the next action. don't proceed directly to token-heavy work like implementation, or hard-to-reverse changes like updates to a remote tracker.

ask where my competence adds information: assume i deeply understand the program theory, not opaque implementation internals. teach constraints that leak into its promises before asking me to revise them. use experiments for agreed measurable criteria; frontier consultation can settle a provisional choice under incomplete criteria. record worthwhile desiderata/measurement refinement separately, with a condition for revisiting the choice.
