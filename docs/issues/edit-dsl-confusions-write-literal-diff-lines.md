---
stage: done
author: session:2026-09-26T09-29-46-063Z_01a0dd0c-9b4f-7795-aad1-0299963801cf
---

Two September 26 Concept implementers report feeding conventional diff `+`/`-` body lines to `ab edit`, which wrote them literally; they recovered by rereading anchors and replacing the range. Other reports describe missing blank separators, `<time` mistaken for insertion syntax, partial-range replacement, and an unknown-anchor diagnostic pointing at the next header.

Resolved as diagnostics and guidance, not automatic patch interpretation. Bash's tool description, edit help and parser grammar now distinguish literal replacement text from unified diffs and one-line targets from block ranges. Diff-looking bodies (multiple nonblank lines all beginning with + or -, including an addition) receive a warning in the edit report; their bytes are still written literally. Legitimate source is neither stripped nor rejected by that heuristic. This does not prevent all mistaken edits.

Header-like content can now be escaped immediately before its sigil after indentation, preserving indented JSX such as `\<time`. The collision error explains both alternatives: separate another hunk, or escape literal content. Unknown-anchor errors name the missing endpoints. Missing blank separators still reject the edit; no range expansion or syntax-aware rewriting was added.

Original receipts: `01a0dcb1-d154-7338-a04c-0480e8abb150`, JSONL 60, passed a six-line CSS diff under a single-anchor replacement; the resulting diff visibly contained literal markers and the untouched remainder of the old block. `01a0dcb1-cb6d-71f3-804c-4ef7827f479c` rejected the indented `<time` line as a header during recovery. In `01a0d8ad-5d89-74b7-8fac-fe2edb023f1b`, JSONL 92, the reported misdirected unknown-anchor diagnostic was actually a missing blank separator before `=muv5`; parsing correctly stopped before anchor lookup. That report does not establish an anchor-lookup defect.

Verification: 60 tests passed across outline-read and bash, including literal diff preservation/warnings, block endpoints, indented JSX and doubled escapes, and unknown-endpoint refusal without file changes. Fresh-worker error frequency has not been measured; warnings can still be overlooked.

[Session evidence and dispositions](../research/session-friction-review-2026-09-26.md).
