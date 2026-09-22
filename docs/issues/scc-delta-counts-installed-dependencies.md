---
stage: idea
assignee: agent
author: session:run:run_00e131a4d024
---

During the September 22 tracker migration, scc-delta.sh against a5bb3a3 over lib and the tracker scripts directory reported code 8,747 → 1,626,597 and complexity 2,339 → 83,571. The baseline is a fresh detached worktree; the current checkout has installed dependencies under those directories. This directory-level comparison is not a source-change measurement.

Restricting the same command to the three changed TypeScript files reports +16 code / +4 complexity. Reproduce and determine which installed/untracked paths entered the directory totals before using this helper as a gate. Helper: skills/enabled/all/mlegls/conventions/setup-project/references/lints/scc-delta.sh.
