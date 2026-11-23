---
stage: "done"
assignee: "agent"
priority: 3
author: "session:01a20657-0e8d-726c-98b9-a4f79a5a23fc"
---
Found in the 2026-11-23 audit of the supervision/issue orchestration system (@thread:thr_3pkhxrd57p). `bun run typecheck` fails with 57 errors, all in [extensions/obsidian-tracker/](../../extensions/obsidian-tracker/); the rest of the repository is clean. Done when `bun run typecheck` passes.

## Result

done. The fix holds on a cold install, which was the gap the driver flagged in their caveat.

The change is one line in the README's Development section: run `bun run setup` before `bun run typecheck`. The `setup` script already existed at the base, and the code needed no change.

To check the cold path, I moved `extensions/obsidian-tracker/node_modules` aside. `tsc --noEmit` then showed exactly 57 errors, the same count the audit found. `bun run setup` reinstalled `obsidian@1.13.1`, and `bun run typecheck` exited 0 with no errors in about 20 s. I added this run to the evidence file under a Review section and committed it as 91b6ab9a.

```yaml
commit: 91b6ab9a
stories:
  - story: "`bun run typecheck` passes after documented setup"
    outcome: held
evidence:
  path: docs/attachments/obsidian-tracker-fails-typecheck/index.md
  visual: false
  shots: []
tests: []
filed: []
fixed: []
caveats: []
```

Evidence: [docs/attachments/obsidian-tracker-fails-typecheck/index.md](../attachments/obsidian-tracker-fails-typecheck/index.md)
