# lint

Jev-judged span lints for the code and testing guidelines. Code finds candidates and builds
their context; Jev answers narrow questions; probabilities are ranked, never gated.

    bun lib/lint/extract.ts <repo> <tsconfig>[,<tsconfig>] > spans.jsonl
    bun lib/lint/judge.ts < spans.jsonl > findings.jsonl
    bun lib/lint/score.ts findings.jsonl lib/lint/labels/<repo>.tsv

Kinds and what a full run over concept (2193 spans, ~50s, ~2M tokens) showed:

| kind/question | status |
|---|---|
| static (type predicate satisfied by declared type; field nothing names) | pure structure, no question; `beyond_type` then asks whether the predicate body checks more than the type carries (AUC 1.0, n=5) |
| field/inert | the useful one: fields written and never read for a decision (AUC 0.67, n=12; every miss is a pass-through to an external library, which is structurally detectable and not yet filtered) |
| expect/off_concept | with concept notes as state, finds behavior the docs never promise; reads as doc drift from the test side (AUC 1.0, n=4) |
| expect/implementation_detail | concept notes halve the mean; effect-yield assertions still read as internals without the story step |
| expect/tautological, expect/typed | no separation; typed never exceeds 0.42 |
| guard/excluded, guard/revalidates | no separation after the compiler's own lints and the static rules; what remains is not a semantic question |
| catch/swallows | accurate description of parse-or-undefined idioms, not a smell by itself |
| */just_in_case | 0.5 everywhere without callers in state |

Labels are sparse and mine; overwrite them. Sample sizes are too small to trust any AUC to
a decimal; the point is which questions separate at all.
