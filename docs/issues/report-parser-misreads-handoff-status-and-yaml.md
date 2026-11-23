---
stage: "done"
assignee: "agent"
priority: 2
author: "session:01a20657-0e8d-726c-98b9-a4f79a5a23fc"
---
Found in the 2026-11-23 audit of the supervision/issue orchestration system (@thread:thr_3pkhxrd57p).

> [report.ts](../../lib/report.ts#L46-L51) raises false status conflicts on standalone headings/bullets (`### Blocked`), picks the first YAML fence containing any key, and drops `visual-reviewer`'s `data:` handoff key.

Done when a report whose prose has a `### Blocked` heading or a `- blocked` bullet keeps its sentinel status, the handoff is the fence with handoff keys (the last such fence when several have them), and `visual-reviewer`'s `data` key survives parsing. Related: [[projects/mlegls-pi/issues/report-unrecognized-yaml-handoff-is-silent]].

## Result

done. All three stories hold on the final head, `7b9165b0`. I also fixed a regression the candidate introduced.

**The regression:** `dda7aacd` cut back the prefix stripping in `statusAt` so that later `### Blocked` headings and `- blocked` bullets would stop counting. But `statusAt` also reads a report's first line, so reports that start with `## Done`, `# Done` or `> done — ok` came back with no status at all. The base, `6e253b30`, read them correctly. The fix, `9c4170d8`, puts the stripping back in `statusAt` and keeps the bare-word rule only in the scan for later lines.

**Re-drive:** I re-ran all of these through the `bun -e` parser entry point on the final head:
- **Leading markers:** those report openings read `done` again, and `Report:` followed by `## blocked` reads `blocked`.
- **Later markers:** a later `### Blocked`, `- blocked` or `> blocked` still leaves `done` with no conflict.
- **Bare word:** a bare `blocked` line still raises a conflict, as before.
- **Driver's rows:** the three YAML rows match what the driver saw, including the data-only payload.

`bun test lib/report.test.ts` passes 17 of 17. My review is appended to the driver's packet. Nothing else was started.

```yaml
commit: 7b9165b0
stories:
  - story: A Markdown heading or bullet leaves the sentinel status intact.
    outcome: held
  - story: The last fence with handoff keys wins.
    outcome: held
  - story: A visual reviewer's data payload survives parsing.
    outcome: held
evidence:
  path: docs/attachments/report-parser-misreads-handoff-status-and-yaml/index.md
  visual: false
  shots: []
tests: []
filed: []
fixed:
  - "9c4170d8: a leading `## Done`, `# Done` or `> done` (and a sentinel after a short heading) parsed to status null after dda7aacd; prefix stripping is back for those positions, and the later standalone scan still needs bare words"
caveats:
  - "`data` is now a handoff key for every role, so with last-fence-wins, an example YAML block with a top-level `data:` after a real handoff would replace it."
```

Evidence: [docs/attachments/report-parser-misreads-handoff-status-and-yaml/index.md](../attachments/report-parser-misreads-handoff-status-and-yaml/index.md)
