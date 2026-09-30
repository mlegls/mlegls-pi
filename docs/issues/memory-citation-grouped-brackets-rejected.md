---
stage: idea
assignee: agent
author: session:01a0f2d2-1c2e-719c-95a8-e505ce8ad9e4
---

`citations()` in `extensions/memory/core.ts` matches only `[@id]`, one ID per bracket. A checkpoint that cites `[@ea04098b, @55783182]` counts as citing nothing, so `parseBlock` rejects it with "no citation to a newly folded source" and the whole fold is cancelled (`Memory not compacted`), although the prose is otherwise fine.

Observed with `claude-sonnet-4-6` (the `memory-failed-*.md` candidates cited `[@a, @b]`) during the empty-journal recipe drive (`docs/attachments/supervisor-hibernation-empty-journal/driver.md`, review section); the earlier Haiku failures fit the same cause but were not inspected for it. Whether to accept grouped brackets or strengthen the instruction changes the default H path, so it was not made under the empty-journal ticket.
