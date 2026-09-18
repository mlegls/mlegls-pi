---
claimed-by: frontier/0919/payload
next: simplify
priority: 2
---

five workers in run reorg/0918 hit the same seam in exec: text payloads that contain backticks or `${` — code with template literals, shell here-docs, markdown with code spans — cannot go through the tagged-template forms of `edit`, `write`, or `sh` without escaping that either breaks the cell's parse (escaped backtick inside a template: ERR_INVALID_TYPESCRIPT_SYNTAX) or interpolates as JS. workarounds used: `edit([{...text}])` array form, string concatenation, a placeholder character replaced with a backtick, `sh(string)`. observed in [[projects/mlegls-pi/issues/archive/session-instrumentation]], [[projects/mlegls-pi/issues/archive/supervision-join-script]], [[projects/mlegls-pi/issues/pool-aware-routing]].

adjacent, same run:
- cells killed at the 30s deadline lose buffered stdout; long suites and clones must go through `term` or an explicit `timeoutMs`. the timeout notice should say so, and partial output should survive.
- `show` 16 KiB cap with no per-result guidance; a read of several files in one cell truncates silently past the first. reads of large fetched pages want a fetch-to-file result.
- top-level `const board` / `const read` collide with the reserved namespace; the error should name the collision.
- `grep` selection row shape (`[...sel][0].anchor`) costs a round trip to discover.
