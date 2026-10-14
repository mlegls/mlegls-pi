---
stage: ticket
assignee: agent
author: session:cb714bb4-5239-4dd1-b675-73ab6f00dcfe
---
Done: `read({path: '"dir/a b.md"'})` reads `dir/a b.md`, through codemode and directly; an unquoted literal path containing spaces that exists still wins over splitting. A test in `lib/outline-read` covers both.

Cause (2026-10-14 triage): the read tool is this repo's `lib/outline-read/read.ts` (registered by `extensions/fragment`), not pi's. `execute` computes `specs = words(params.path)` but when there is one spec it reads `[params.path]`, the raw string with its quotes. Use `specs` when `words` yields one spec; keep the raw string only for the existing-literal-path case. Reproduced 2026-10-14 with `/tmp/sp test/a b.md`.

The codemode `read` tool advertises quoted paths for names containing spaces, but treated the quotes as part of the filesystem name during Concept's review-card scale probe (2026-10-10).

`tools.read({path: '"docs/core/concepts/Personal scope.md"'})` returned `ENOENT .../"docs/core/concepts/Personal scope.md"`. The earlier backslash-escaped form was split at the space and looked for `docs/core/concepts/Personal\`. The file exists; `tools.grep({pattern: ".", path: "docs/core/concepts", glob: "Personal scope.md"})` read its complete seven-line content and was the workaround. No read-bridge implementation was inspected. Owner: pi's codemode file-read argument handling or its advertised contract.

Drive observation (2026-10-14): supplied runner passes (1 test, 2 expectations) on f90bdd0797b28b1be2fd561201c501bcd29f04c1. This session's live codemode read still rejects a quoted driver-owned space-containing path with ENOENT including literal quotes; the unquoted equivalent succeeds. This may be a loaded-extension/reload discrepancy, not established as a failure of the committed library. Evidence: [drive packet](../attachments/codemode-read-does-not-honor-quoted-space-containing-paths/index.md). Direct standalone tool use remains unobserved. Reviewer must establish fresh runtime behavior before acceptance.
