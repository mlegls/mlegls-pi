---
stage: idea
assignee: agent
author: session:cb714bb4-5239-4dd1-b675-73ab6f00dcfe
---

The codemode `read` tool advertises quoted paths for names containing spaces, but treated the quotes as part of the filesystem name during Concept's review-card scale probe (2026-10-10).

`tools.read({path: '"docs/core/concepts/Personal scope.md"'})` returned `ENOENT .../"docs/core/concepts/Personal scope.md"`. The earlier backslash-escaped form was split at the space and looked for `docs/core/concepts/Personal\`. The file exists; `tools.grep({pattern: ".", path: "docs/core/concepts", glob: "Personal scope.md"})` read its complete seven-line content and was the workaround. No read-bridge implementation was inspected. Owner: pi's codemode file-read argument handling or its advertised contract.
