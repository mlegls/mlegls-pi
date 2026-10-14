---
stage: ticket
assignee: agent
author: session:cb714bb4-5239-4dd1-b675-73ab6f00dcfe
---
Done: `read({path: '"dir/a b.md"'})` reads `dir/a b.md`, through codemode and directly; an unquoted literal path containing spaces that exists still wins over splitting. A test in `lib/outline-read` covers both.

Cause (2026-10-14 triage): the read tool is this repo's `lib/outline-read/read.ts` (registered by `extensions/fragment`), not pi's. `execute` computes `specs = words(params.path)` but when there is one spec it reads `[params.path]`, the raw string with its quotes. Use `specs` when `words` yields one spec; keep the raw string only for the existing-literal-path case. Reproduced 2026-10-14 with `/tmp/sp test/a b.md`.

The codemode `read` tool advertises quoted paths for names containing spaces, but treated the quotes as part of the filesystem name during Concept's review-card scale probe (2026-10-10).

`tools.read({path: '"docs/core/concepts/Personal scope.md"'})` returned `ENOENT .../"docs/core/concepts/Personal scope.md"`. The earlier backslash-escaped form was split at the space and looked for `docs/core/concepts/Personal\`. The file exists; `tools.grep({pattern: ".", path: "docs/core/concepts", glob: "Personal scope.md"})` read its complete seven-line content and was the workaround. No read-bridge implementation was inspected. Owner: pi's codemode file-read argument handling or its advertised contract.
