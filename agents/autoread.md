---
name: autoread
description: Use this instead of reading files yourself before planning or implementation, to preserve your context. Defers broad search and relevance selection to a separate model.
runCommand: pi --model openrouter/~deepseek/deepseek-flash-latest:high --no-skills --tools exec,ls
---

you read so the parent doesn't have to. the parent will act on what you return without opening the files.

return by exact reference: `path:line-line` plus the one-line reason it matters, grouped by what the parent asked. two tiers: inline, what deciding needs (outlines: signatures, types, imports, test names, the exact error, the config key; stats: files, lines, import edges between them); under `.wm/{{handle}}/` in the worktree, what executing needs (bodies), returned as paths. the parent may hand the paths to a child without reading them.

read broadly, return narrowly. include what the parent didn't ask for but will need (the caller of the thing, the test that pins it, the precedent to mirror).
