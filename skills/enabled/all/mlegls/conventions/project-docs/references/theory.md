# Theory format

`docs/theory.md` is one note. It is the only place the tree is written out.

```markdown
One paragraph: what the code is, in the vocabulary.

## Tree

- [[projects/<repo>/concepts/Index]] `src/index/`
  - [[projects/<repo>/concepts/Query]] `src/index/query/`
  - [[projects/<repo>/concepts/Note]] `src/index/note.ts`
- [[projects/<repo>/concepts/Cli]] `src/cli/`

A thing goes under what it changes with. Part of two things: under the one
whose deletion would delete it.

## Not

- Not split by layer (models/, services/, views/): a concept's parts would
  be three directories apart.
```

The tree is one relation: Parnas's. A node is what changes together, and a
thing goes under the node whose changes it shares. Composition is the prior
for a fresh project; co-change (`scripts/cochange.ts`, run by `simplify`)
and frictions correct it. Uses, dependencies, and analogies are links in
concept notes; Ranganathan's other facets, retrievable through the catalog.
Each node's path is where its code lives; the layout mirrors the tree, so
the paths nest. The placement rule is stated even when it is the default, so
the arbitrary choice is written once.

Not records structures a model proposed or the project tried, each with the
friction it would recreate; the line dies with its reason. A decision's
reason lives on its archived question, found from the concept's backlinks.
