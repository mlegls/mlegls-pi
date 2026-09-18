---
tags: [task]
status: x
next: done
priority: 2
---

five workers in run reorg/0918 hit the same seam in exec: text payloads that contain backticks or `${` — code with template literals, shell here-docs, markdown with code spans — cannot go through the tagged-template forms of `edit`, `write`, or `sh` without escaping that either breaks the cell's parse (escaped backtick inside a template: ERR_INVALID_TYPESCRIPT_SYNTAX) or interpolates as JS. workarounds used: `edit([{...text}])` array form, string concatenation, a placeholder character replaced with a backtick, `sh(string)`. observed in [[projects/mlegls-pi/issues/archive/session-instrumentation]], [[projects/mlegls-pi/issues/archive/supervision-join-script]], [[projects/mlegls-pi/issues/pool-aware-routing]].

adjacent, same run:
- cells killed at the 30s deadline lose buffered stdout; long suites and clones must go through `term` or an explicit `timeoutMs`. the timeout notice should say so, and partial output should survive.
- `show` 16 KiB cap with no per-result guidance; a read of several files in one cell truncates silently past the first. reads of large fetched pages want a fetch-to-file result.
- top-level `const board` / `const read` collide with the reserved namespace; the error should name the collision.
- `grep` selection row shape (`[...sel][0].anchor`) costs a round trip to discover.

## decisions

- 2026-09-18: Use existing string arguments and structured edits, with one double-quoted-string / lines.join idiom documented in `extensions/exec/README.md`. No new parser or payload API. Backticks and `${` stay literal; JavaScript string escaping and outer JSON encoding remain.
- 2026-09-18: Timeout/reset includes bounded host-received prefixes of running shell streams; process buffers not yet flushed cannot survive SIGKILL. Notice points long suites/clones toward `term`, explicit deadlines, or retained promises. Reserved-binding errors name the collision and suggest rename/nested scope. Existing show omission notices already give counts and recovery guidance; README adds per-file retention, fetch-to-file, and direct grep row access.
- 2026-09-18: Tried README example through a fresh Kernel: write/edit/sh preserved backticks and `${`; reserved `board` named correctly; a 500ms timeout returned both partial shell streams. Existing kernel tests: 5 pass / 54 assertions. No new tests.
- 2026-09-18: Dogfooding friction: a multi-file show exceeded the shared 16 KiB cap; the explicit notice correctly suggested slices/show.large. A temporary smoke driver accidentally cooked `\n` while embedding code inside another JavaScript string; using the README sample directly fixed it. The non-template idiom removes template escaping, not nested-language encoding. Large fetched pages use curl-to-file rather than a new fetch result API.
