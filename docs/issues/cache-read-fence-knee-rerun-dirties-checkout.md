---
stage: idea
part-of: "[[projects/mlegls-pi/issues/cache-read-fence-knee]]"
---

# Analysis rerun dirties checkout

Owner: mlegls-pi analysis/cache-read-fence-knee packaging.

Observation: in worktree `cache-read-fence-knee-drive` at `733bde2`, running the documented `python3 analysis/cache-read-fence-knee/final.py` with Python 3.14.7 exited 0, but `git status --short` then showed `M analysis/cache-read-fence-knee/__pycache__/scan.cpython-314.pyc`. That compiled cache is tracked (`git ls-files` confirms). Repro: start from a clean worktree, invoke the command, inspect status. Workaround used: `git restore -- analysis/cache-read-fence-knee/__pycache__/scan.cpython-314.pyc` after the drive; this did not affect outputs. No failure in the numerical analysis was inferred from this artifact.

Proposed improvement (not implemented here): stop tracking generated Python bytecode; ensure the supported rerun leaves tracked files clean except intentional analysis outputs. The `tracker` executable was unavailable in this worker environment (`tracker --help` returned command not found), so this local issue is the durable fallback.
