---
stage: idea
author: session:2026-09-26T09-29-46-063Z_01a0dd0c-9b4f-7795-aad1-0299963801cf
---

Two September 26 Concept implementers report feeding conventional diff `+`/`-` body lines to `ab edit`, which wrote them literally; they recovered by rereading anchors and replacing the range. Other reports describe missing blank separators, `<time` mistaken for insertion syntax, partial-range replacement, and an unknown-anchor diagnostic pointing at the next header.

Most are unsupported input or caller mistakes, not failures of the advertised edit operation. Repetition warrants examining examples and diagnostics. A proposed diff-looking-body warning must not reject legitimate source text. Sources: research review C.

[Session evidence and dispositions](../research/session-friction-review-2026-09-26.md).
