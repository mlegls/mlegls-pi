---
next: simplify
priority: 3
---

A vault worker passed find([glob,...]), expecting parity with grep's path arrays, and received a low-level path.isAbsolute TypeError. Reproduced September 21 with find(['*.md']): “The path argument must be of type string. Received an instance of Array.” [Triage](../research/session-friction-triage-2026-09-21.md).

find supports one glob plus options; brace globs or separate calls already cover multiple patterns. Reject the wrong argument shape at the public boundary with the supported signature and a useful alternative rather than adding array semantics. Keep supported glob behavior unchanged.
