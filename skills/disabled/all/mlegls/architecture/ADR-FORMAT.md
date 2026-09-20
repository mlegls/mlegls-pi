# ADR format

ADRs live in the collection mapped for their scope by `docs/README.md`, numbered
sequentially as `0001-slug.md`. Create the collection on first use.

```markdown
# {Short decision title}

{What was decided and why.}
```

A decision earns an ADR when it is hard to reverse, surprising from the code,
and chosen among real alternatives. One paragraph is normal.

Optional, when useful:

- `status: proposed | accepted | deprecated | superseded by ADR-NNNN`
- `## Considered options`
- `## Consequences`

Amend an ADR while the decision retains its identity. `superseded by` means a
new decision replaces it.
