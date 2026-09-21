---
name: pi
description: Use when configuring, extending, debugging, or answering questions about the pi coding agent harness, including extensions, custom tools, skills, prompts, themes, packages, and the SDK.
---

# Pi

Read the installed pi documentation and relevant examples before implementing changes. Follow relevant `.md` cross-references.

Locate the active installation with `mise which pi` (or `command -v pi` when not managed by mise). Follow executable symlinks and find the enclosing `@earendil-works/pi-coding-agent` package root; verify its `package.json`. Prefer this installation's docs over a project's potentially older dependency. Do not hardcode a versioned installation path.

Relative to that package root:
- Main documentation: `README.md`
- Additional docs: `docs/`
- Examples: `examples/` (extensions, custom tools, SDK)

Resolve `docs/...` and `examples/...` references under that package root, not the current working directory. Resolve other Markdown links relative to the referring document.
