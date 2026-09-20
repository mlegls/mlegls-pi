# Concept format

`docs/concepts/<Name>.md`, the name as used in conversation. Sparse: the note
is a link target, and the graph around it is the documentation.

```markdown
---
path: src/index/query/
part-of: "[[projects/<repo>/concepts/Index]]"
not: [search, filter]
---

A read over the [[projects/<repo>/concepts/Index|Index]] returning Note
references. Composes [[projects/<repo>/concepts/Filter|Filter]]s; never
holds a [[projects/<repo>/concepts/Note|Note]]. `test/query.test.ts`: can
find a note by title from an empty index.
```

`path` is where the concept lives in code, a list while the code is still
scattered; `part-of` is its parent in the tree, matching `theory.md`. Links
are vault-absolute and aliased to the name as spoken, so the prose reads and
the link resolves. `not` lists words that mean this concept but are
not used, so a search for the wrong word finds the right note. Not Obsidian
aliases: a link to the wrong word should not silently resolve.

A concept corresponds to something in present or decided code: a type,
module, algorithm, or data structure. A step a user performs is an operation
on one, and its step test is cited here, named as the step. General programming vocabulary and
domain language the code does not distinguish get no note. One paragraph is
normal; a concept that needs more is usually two concepts, or the extra
belongs in a story or a Why line.
