---
name: project-docs
description: "Use when reading or editing a project's theory, concepts, stories, or frictions; explains their roles and defines their formats."
---

my project docs realize Naur's sense of "Programming as Theory Building" via a concrete lifecycle. .md format is obsidian-style (usually in an actual vault).

`docs/theory.md` - describes a concrete (even if sometimes arbitrary) monohierarchical projection from the rhizomatic layout in `docs/concepts` onto the arborescent filesystem, so that new code additions/files have one obvious place to go. organized by cochange (via `scripts/cochange.ts`)
`docs/concepts/<concept>.md` - a glossary of the context's ubiquitous language, cross-linked obsidian-style. it functions as a wiki of the program theory.
`docs/stories/<id>.md` - real situations and wants, including the maintainer's, motivating issues. planning refines intended behavior; first use supplies evidence and tests. small cross-linked files by purpose, with scenarios where useful. personas are reusable starting states.
`docs/guide/<task>.md` - how to use the actual product, `for:` the persona. written just before or during first use alongside its recording; reviewed encounters supply the replay checks. cited by stories.
frictions - Ousterhout symptoms or deferred costs, recorded for later triage. where `docs/issues/` exists, each is its own `stage: idea` issue (`tracker`), never a `docs/frictions.md`. only a project without `docs/issues/` keeps one-liners in `docs/frictions.md`.

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
