# Glossary format

The glossary is the context's shared vocabulary, at the path mapped in
`docs/README.md`. It starts when the first term resolves.

```markdown
# {Context name}

{What this context is and why it exists.}

## Language

**Invoice**:
A request for payment sent to a customer after delivery.
_Avoid_: Bill, payment request
```

Each entry defines what a term is. `_Avoid_` records rejected synonyms when
there are any. The vocabulary is specific to the codebase, including its theory
rather than just conventional domain language; general programming vocabulary
needs no glossary here.

Terms have direct analogs in present or decided code: types, modules,
algorithms, data structures. The theory's concepts come first, then phenomenal
and interface vocabulary, grouped where natural.
