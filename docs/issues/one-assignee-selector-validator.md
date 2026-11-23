---
stage: "ticket"
assignee: "agent"
priority: 3
author: "session:01a20657-0e8d-726c-98b9-a4f79a5a23fc"
---
Found in the 2026-11-23 audit of the supervision/issue orchestration system (@thread:thr_3pkhxrd57p). Four incompatible `assignee` validators:

- vault: `validAssignee` in [issues.ts](../../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts)
- GitHub: [tracker-github-write.ts:115](../../lib/tracker-github-write.ts) (agent, human, `user:`)
- dispatch: [dispatch.ts:72](../../lib/dispatch.ts)
- Obsidian: [model.ts:90](../../extensions/obsidian-tracker/model.ts)

The [lifecycle](../../skills/enabled/all/mlegls/conventions/tracker/references/lifecycle.md) defines the selector grammar once. Done when all four call one parser of that grammar, and a backend that can't represent a selector (GitHub labels) says so by name rather than "unsupported assignee selector".
