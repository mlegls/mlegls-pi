---
tags: [task]
next: measure
parent: "[[projects/mlegls-pi/issues/ingress-filter]]"
---

can jev separate the files a session acted on from the ones it read and never referenced? the audit labeled 3648 unique `read` calls: 58% acted on, 24% never referenced. for a sample of sessions, reconstruct the conversation state at each read, chunk the file, score with jev, and check whether the kept set covers the acted-on files and drops the never-referenced ones. report precision/recall at several thresholds and the calibration curve.

done: a number that says how much of the 24% (and of the whole-file bytes in the 58%) the filter would remove at a given miss rate. if jev cannot separate them, the query serialization is wrong before the filter is worth building further.

harness: session parser from the audit (tool classification, basename-referenced labels) plus a chunker for source files; outline-read's symbol split is enough.
