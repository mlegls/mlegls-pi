---
stage: done
---

Owner: mlegls-pi analysis/cache-read-fence-knee packaging.

Observation: in worktree `cache-read-fence-knee-drive` at `733bde2`, running the documented `python3 analysis/cache-read-fence-knee/final.py` with Python 3.14.7 exited 0, but `git status --short` then showed `M analysis/cache-read-fence-knee/__pycache__/scan.cpython-314.pyc`. That compiled cache is tracked (`git ls-files` confirms). Repro: start from a clean worktree, invoke the command, inspect status. Workaround used: `git restore -- analysis/cache-read-fence-knee/__pycache__/scan.cpython-314.pyc` after the drive; this did not affect outputs. No failure in the numerical analysis was inferred from this artifact.

The driver attempted `tracker --help` (command not found) and used this local issue as the fallback. Review found that this project's tracker is the Markdown vault adapter, not a `tracker` executable; no CLI installation is required.

Result: repaired in the cache-read-fence-knee review. Removed the tracked bytecode, ignored Python caches, and disabled bytecode writes before CLI imports. Both supported entry points rerun against the unchanged historical corpus without changing tracked outputs. The packet's [review appendix](../attachments/cache-read-fence-knee/index.md#review-and-redrive) and CLI regression test record the replay. This friction is not an execution child of the research ticket.
