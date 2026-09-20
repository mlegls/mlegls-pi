---
name: stories
description: "Use when discussing product behavior, before writing a spec or test, or when asked whether behavior is proven."
---

The stories document is an argument that the product does what matters to its
users. Theory explains the code; stories explain why its behavior is useful.
`docs/README.md` maps both. `testing` supplies evidence for gaps in the argument.

A root story has an H2 and a stable ID. Dotted children are lemmas or narrower
claims; actors and `via:` are inherited. Actors are people or external systems,
including the importing developer of a library.

```markdown
## `search` As a note-taker, I can find notes without changing them.

via: a Query over the Index; the read path never touches a Note.

- `search.match` I can find a note by a word in its title or body.
  ∵ test:search_matches_title_and_body; law:query-is-read-only
- `search.cli` As a scripter, I get the same matches from `notes search`.
  ∵ given:search.match; test:cli_search_matches_ui
- `search.keyboard` I open search with `/` without inserting a slash.
  ∵ driven:verify-notes/search-open; ?:slash-not-inserted
- `search.saved` I can save a query and rerun it.
```

`via:` joins a user distinction to its realization in theory concepts, usually
in one sentence. A child records only its difference from the inherited
realization. Distinct benefits can share a mechanism. When a code path is the
only honest description, it may expose a concept the theory is missing.

`∵` cites the premises and observations supporting the claim:

| Citation | Meaning |
|---|---|
| `test:<name>` | A product-argument test |
| `driven:<verify-skill>/<recipe>` | A recipe for observing the real product |
| `law:<name>` | A stated theory assumption |
| `ext:<guarantee>` | A documented dependency or platform guarantee |
| `given:<story-id>` | Another claim used as a lemma |
| `?:<gap>` | What is still needed to complete the argument |
| `bug:<issue>` | An observed counterexample, optionally `against <citation>` |

Premises may work together. Split into lemmas or add ordinary prose where the
composition is not apparent; each citation need not independently prove the
whole claim. A passing test supports only what it actually observes, and a
recipe's existence does not mean it has run successfully.

Confirm the proposed story-document changes before recording them (`grilling`),
or include them in an explicitly approved publication batch.

An agreed story starts without realization or evidence. Implementation adds
`via:`; testing and product verification add the corresponding evidence. Specs
can propose these changes without claiming they have already happened.

The argument can be unimplemented, incomplete, supported under stated
assumptions, or refuted by observation. Derive that judgment from the argument
and current evidence, not a status field or the mere presence of citations. A
false lemma calls its dependents into question, including `given:` references;
shared vocabulary alone does not propagate refutation. A regression test can
replace a `bug:` once it captures the counterexample.

There is one repository story tree, even across theory contexts. Split large
subtrees into indexed files when useful, keeping IDs stable and updating the
docs map. This is a document people and agents read, not a proof language that
needs a checker before it has earned one.
