---
stage: idea
assignee: human
author: session:2026-09-26T12-56-58-521Z_01a0ddca-4f99-714a-be5c-46535cc1fc2a
---

How important is keeping one continuous verbatim tail, compared with allowing the model to retain disjoint excerpts? The memory extension currently permits only a model-chosen continuous suffix (`tail.mode: model-contiguous`).

The continuous choice came from ~/dev/data/experiments/kv-diff (Qwen2.5 7B/14B): dropping the front of a context ("rolling") leaves V at the retained positions above 0.97 cosine until about 80% of the context is removed, and the generating state stays close; scrambling the same tokens drops V to about 0.10, indistinguishable from unrelated text. That supports "a suffix keeps its own states", but it doesn't measure what a disjoint excerpt costs. An excerpt keeps its internal order and loses only its true predecessors, which looks more like several short rolls with a seam each than like scrambling.

Untested: token-aligned V similarity inside a retained segment as a function of distance from its seam, for (a) the original full context, (b) memory + continuous tail, (c) memory + earlier excerpt + later excerpt. If the per-seam cost decays within a few dozen tokens, excerpts are cheap representationally and the question becomes behavioral (does the model follow the thread across gaps). The existing summary experiment compared positions by index across different sequences, which cannot answer this. kv_diff_extended.py's extraction and cos helpers should be reusable.

Partial existing coverage: cited originals are already retrievable on demand through memory recall, which is disjoint access by retrieval rather than retention. CacheBlend and similar work measure the cost of concatenating separately computed KV chunks. That's not directly applicable to API providers (they re-prefill the text), but it's relevant for seam-recovery intuitions.
