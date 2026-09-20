---
name: project-docs
description: "Use when reading or editing a project's theory, concepts, stories, or frictions; explains their roles and defines their formats."
---

my project docs realize Naur's sense of "Programming as Theory Building" via a concrete lifecycle. .md format is obsidian-style (usually in an actual vault).

`docs/theory.md` - describes a concrete (even if sometimes arbitrary) monohierarchical projection from the rhizomatic layout in `docs/concepts` onto the arborescent filesystem, so that new code additions/files have one obvious place to go. organized by cochange (via `scripts/cochange.ts`)
`docs/concepts/<concept>.md` - a glossary of the context's ubiquitous language, cross-linked obsidian-style. it functions as a wiki of the program theory.
`docs/stories/<id>.md` - like Cohn, except "as an x, y" must be an honest thought of a real x (including programmer/maintainer as themselves). each story is derived into the sequence(s) of affordances that realize it, then each affordance into program steps, from which the test suite is built bottom-up. personas are fixtures.
`docs/guide/<task>.md` - user-facing docs, doubling as verification instructions (cited by `stories`), `for:` the persona.
frictions - Ousterhout symptoms or deferred costs, recorded for later triage. issues in a vault project (`tracker`), one-liners in `docs/frictions.md` otherwise.

## Layout

determine the appropriateness of one vs multiple contexts by the frequency of cross reference. for one context,

docs/
  theory.md
  concepts/
  stories/
  guide/

for multiple

docs
  <context>/
    theory.md
    concepts/
    stories/
    guide/

Formats:

- [Theory](references/theory.md)
- [Concept](references/concept.md)
- [Stories](references/stories.md)
- [Contexts map](references/contexts.md), for multiple contexts only
