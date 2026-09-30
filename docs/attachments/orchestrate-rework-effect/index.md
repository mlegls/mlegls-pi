# Orchestrate rework effect — first-use drive

## Setup

- Tested revision: `4c95f4a284c8939418b2f34be68d21570785473b`.
- Persona: local researcher reading the ticket and running its supplied reproduction command; no authentication.
- Deployment: static local CLI analysis in this worktree, `/Users/mlegls/dev/mlegls-pi__worktrees/orchestrate-rework-effect-drive`. No service, port, browser or deployed state.
- Entry point: `python3 docs/analysis/orchestrate-rework-effect/metrics.py`.
- Inputs: existing `~/.local/share/pi-board/log.jsonl` and `~/.pi/agent/sessions`; both exist and are readable. No seeding, selector reuse or destructive setup is required. Inputs are shared read-only historical records, not checkout-owned writable state.
- Visual: false; no screenshots.

## Predictions — recorded before opening the report or running the CLI

These predictions come from the ticket and setup command. The required peer-board read exposed the implementer's conclusions first; this is not a fully blind trial. No source, diffs, tests or fixtures were read.

1. **Per-run comparison:** I expect the supplied command to complete successfully and expose a reproducible table of runs grouped by board topic prefix, separating 09-14..15 from 09-16..22. Every run should have worker count, usage cost, checkpoint count, never-done fraction and distinct dispatching-parent cwd count.
2. **One-handle hypothesis:** I expect to be able to tell whether after-runs have exactly one dispatching-parent cwd, and whether that differs from baseline. A negative or non-discriminating result is acceptable; the story is measurement, not proving the hypothesis true.
3. **Never-done and checkpoints:** I expect the factor-finish baseline exemplar to be visible, with a stated denominator and rule for counting never-done. The extended after-window should be explicit rather than silently stopping at 09-16.
4. **Cost and interpretation:** I expect era comparisons and an explanation of cost ownership (worker versus parent), list-price estimates, missing-data limits, roster changes including opus leaving, and later routing changes. The 09-23 paseo campaign should stay outside the measured corpus.
5. **Reproduction usability:** I expect the command to say where its result is, and repeated runs over unchanged historical inputs to reproduce the same measurements without services or credentials.

## Session log

- 2026-09-30: Read the ticket, evidence rules and required peer board. Confirmed clean worktree at the tested revision and existence of the supplied entry point and historical input locations. Did not inspect the script.
- Readiness at this point: files are available; actual CLI readiness remains to be established by execution.
