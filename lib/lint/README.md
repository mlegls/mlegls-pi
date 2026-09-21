# lint

Jev-judged span lints for the code and testing guidelines. Code finds candidates and builds
their context; Jev answers narrow questions; probabilities are ranked, never gated.

    bun lib/lint/extract.ts <repo> <tsconfig>[,<tsconfig>] [sinceRef] > spans.jsonl
    bun lib/lint/judge.ts < spans.jsonl > findings.jsonl
    bun lib/lint/score.ts findings.jsonl lib/lint/labels/<repo>.tsv

With sinceRef only spans on lines the working tree adds over that ref are judged, while the
reference index still covers the whole repository. Five commits of concept: 40 spans, 9s.
The whole tree: 1168 spans, ~30s.

| kind/question | what it found on concept |
|---|---|
| static (no question) | a type predicate already satisfied by its argument's declared type; an optional field nothing names |
| static/beyond_type | whether that predicate's body checks more than the type carries: format, range, finiteness (AUC 1.0, n=5) |
| field/inert | fields written and never read for a decision (AUC 0.88, n=10) |
| expect/off_concept | with the concept notes whose `path:` names the code under test as state, assertions on behavior the notes never promise; doc drift read from the test side (AUC 1.0, n=4) |
| expect/implementation_detail | ambiguous; concept notes halve the mean, effect-yield assertions still read as internals without the story step |

Tried and dropped: guard questions (excluded, revalidates, just-in-case) once the compiler's
own lints and the static predicate rule take the structural cases, nothing left separated;
catch/swallows accurately describes parse-or-undefined idioms, which are not smells; expect
tautological and typed never separated. Fields whose value flows into a node_modules library
are filtered structurally, which removed every false positive inert had.

Labels are sparse and mine; overwrite them. Sample sizes are too small to trust any AUC to a
decimal; the point is which questions separate at all.
