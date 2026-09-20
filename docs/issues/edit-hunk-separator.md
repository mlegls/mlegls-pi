---
tags: [task]
next: implement
priority: 2
---

four workers in run frontier/0919 wrote edit hunk headers into files as content. `parseHunks` (`extensions/outline-read/edit.ts`) recognizes a header only when the previous line is blank; a `=abcd` header or a stray `@path` token immediately after a body line is taken as body. the tool description says "separate hunks with a blank line" but nothing enforces it: an unseparated header is silently content, and the only error path is a body line that *looks* like a header after a blank line. observed forms: `@path` on its own line after the body (written into README and an issue); several `=` hunks in one template without blank separators (headers mixed into the file); a one-line replace whose body swallowed the next hunk (the surrounding line dropped).

fix: a body line that parses as a header (or is a lone `@path` token) is an error naming the line and the separator rule, unless backslash-escaped, same as line 80's check but without requiring the preceding blank. `edit.test.ts` has the parse fixtures.

done: the three observed forms throw before touching disk; `bun test extensions/outline-read` passes; the grammar text says escaped headers are the only way to write one as content.
