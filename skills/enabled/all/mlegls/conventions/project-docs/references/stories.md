# Stories

A story is a real situation and want, with its originating request or observation. It motivates issues; it is not a post-hoc justification for an implementation. Many successive issues can serve the same story.

Use one recognizable situation and purpose per file in `docs/stories/`. Keep alternate routes and interruptions as scenarios within it; split independently meaningful wants into linked files. Organize by meaning, like a glossary. Story links are not execution containment: the issue tree defines supervisor scope.

Start with the want and source. During planning add intended outcomes, a rough affordance sequence, then the consequential behavior needed to try it. Implementation shape belongs in the spec or concept notes. Resolve unknown interactions through research or prototypes where needed.

`docs/guide/<task>.md` is the route through the actual product, `for:` its user or starting persona. Write it just before or during first use, alongside the recording, and correct it against what was encountered. Intended controls stay in the story/spec until usable. Link known limitations without turning them into instructions that cannot be followed.

Review the encounter's actions, screenshots and state; checks come from expectations and uncertainties encountered there (`testing`). Replay the reviewed sequence thereafter. The story links the guide, accepted recording and detailed evidence, and states supported behavior and remaining gaps concisely. A green partial recording is not evidence for omitted steps.

For example:

~~~markdown
---
persona: learner
kind: process
sequence: test/browser/recorded/take-a-lesson.ts
---

## Take a lesson

I choose what I want to learn; the tutor leads me through a lesson.

Start or resume → converse → work with what the tutor presents → leave.
When the tutor refers to a table, I need to reach it without losing the conversation.

Guide: [[projects/example/guide/take-a-lesson]].
The recorded drive covered talking and leaving. Reading stalled at an empty
Materials pane: [[projects/example/issues/material-cannot-be-reached]].
Evidence: [[projects/example/attachments/lesson-drive]].
~~~

Use the project's existing identifiers and recording conventions. `persona` names reusable starting state; one-off setup stays with its scenario. A recording is added when actually driven, not as a promise of future proof. Existing `kind` metadata describes usage, not maturity.

A bug request starts from the sequence in which someone noticed it. Link the issue to that story and preserve the observation; add a scenario when it reveals a distinct route. Program-step inventories do not generate tests. A story is neither an implementation journal nor a verification transcript.
