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
| drift (note × change) | `drift.ts`, also run by `run.ts`: statements of concept notes a change contradicts. Notes pair with the change by `path:` or by title matching a changed file's stem or word (`confirmations.ts` → Confirmation). Per note and ~12k-char diff chunk, a choice over the note's sentences picks the contradicted one, then a yes/no asks whether that sentence is now false. Known drift: the proposal yield/resume landing against Confirmation's "Accepting or declining creates no response turn" (8c47c38c 0.63, 447b2802 0.46–0.60, cae217b3 0.23) and Session's SkillHints error scoping, which 447b2802 removed (0.52–0.59). A model-label change against Session 0.41; 16 unrelated commits at most 0.20. Runs vary ±0.1 |

Tried and dropped: guard questions (excluded, revalidates, just-in-case) once the compiler's
own lints and the static predicate rule take the structural cases, nothing left separated;
catch/swallows accurately describes parse-or-undefined idioms, which are not smells; expect
tautological and typed never separated. Fields whose value flows into a node_modules library
are filtered structurally, which removed every false positive inert had.

Drift tried and dropped: per changed statement against its `path:`-paired notes separated
nothing (0.1–0.5 on both sides), and `path:` alone never paired Confirmation with
`convex/confirmations.ts`, `surfaces.ts` or `turn.ts`, where resume lives. The sentence choice
alone scores 0.8+ on unrelated notes once the note body is in state; the verifying yes/no brings
those to 0.2–0.4. Omissions (compaction landing unmentioned in Session/Work) are not contradictions
and do not fire.

Labels are sparse and mine; overwrite them. Sample sizes are too small to trust any AUC to a
decimal; the point is which questions separate at all.
