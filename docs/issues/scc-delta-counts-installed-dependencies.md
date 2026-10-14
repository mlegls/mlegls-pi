---
stage: done
assignee: agent
author: session:run:run_00e131a4d024
---
Done: `scc-delta.sh` counts only tracked and untracked-not-ignored source on both sides, so installed dependencies (`node_modules` under nested package dirs) and other ignored paths never enter the totals. Feed scc an explicit file list from `git ls-files -co --exclude-standard -- <paths>` (the baseline worktree's `git ls-files`), rather than walking directories. Verify against the original repro: a directory-level run over `lib` and the tracker scripts dir with installed deps matches the per-file delta.

During the September 22 tracker migration, scc-delta.sh against a5bb3a3 over lib and the tracker scripts directory reported code 8,747 → 1,626,597 and complexity 2,339 → 83,571. The baseline is a fresh detached worktree; the current checkout has installed dependencies under those directories. This directory-level comparison is not a source-change measurement.

Restricting the same command to the three changed TypeScript files reports +16 code / +4 complexity. Reproduce and determine which installed/untracked paths entered the directory totals before using this helper as a gate. Helper: skills/enabled/all/mlegls/conventions/setup-project/references/lints/scc-delta.sh.

## Result

done

No defects found in the diff against the ticket, and I made no repairs. I read the `scc-delta.sh` change and the driver's log. I re-checked it myself with scc 3.7.0 on a temporary repository holding a tracked file, a locally deleted tracked file and an untracked file with a space in its name. The result was correct: code 2 → 2, complexity 0 → 0. The deleted file is skipped, and the space-named file is read from the null-delimited `git ls-files -co --exclude-standard -z` list. `bash -n` passes on the helper. I did not re-run the historical repro; the driver's committed packet records it as +16 code / +4 complexity for the directory run, matching the three-file delta. The driver reported no frictions, so there was nothing to settle in the tracker.

```yaml
commit: 7c08892a
stories:
  - story: Historical directory delta matches the three-file delta with dependencies installed
    outcome: held
  - story: Tracked and untracked-not-ignored source count; ignored paths do not
    outcome: held
evidence:
  path: docs/attachments/scc-delta-counts-installed-dependencies/index.md
  visual: false
  shots: []
tests: []
caveats:
  - "Without scc on PATH the helper fails silently, because it sends scc's stderr to /dev/null. A mise shim with no scc configured for the directory does the same. My first check hit this; it needs `mise exec ubi:boyter/scc@3.7.0 --`. This is pre-existing and unchanged by the ticket."
  - "The helper passes every selected file to a single scc call to keep totals exact. A very large selection could exceed the OS argument-length limit. I did not hit this at the ticket's scale of about 1k files, and I did not measure the limit."
  - "The cost is two `git ls-files` runs plus the baseline worktree the helper already created. The driver's historical run took about 3 s."
```

Evidence: [docs/attachments/scc-delta-counts-installed-dependencies/index.md](docs/attachments/scc-delta-counts-installed-dependencies/index.md)
