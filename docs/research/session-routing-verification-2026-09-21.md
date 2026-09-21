# Session-boundary routing verification — 2026-09-21

Scope: importing lib/route.ts as the supervisor; no workers launched and no live sessions switched or closed.

## Live Jev calls

Using routing.md and the configured TypeSafe endpoint:

| Assignment / checkpoint | Observed result |
| --- | --- |
| Recorded fill: supplied literal-change contract | ready, fill; classification bypassed; Luna low |
| Browser verification, no code changes | ready, verify; stance p=1; Luna low |
| Conflicting retention requirements with no delegated decision authority | triage, session-triage; stance p=.99; Fable medium; no worker agent |
| Warm worker only needs final suite and report | continue, p=.99 |
| One interface decision outside a nearly finished worker's authority | consult, p=.96 |
| Repeated capability failure and disproven framing; compacted handoff ready | replace, p=1 |

These are integration observations on illustrative inputs, not classifier calibration or model-quality benchmarks. Model choices remain provisional policy: the verification assignment's cheap-model selection is not evidence of computer-use capability. Probabilities compare supplied alternatives, not task-success likelihood. No cache economics were measured.

## Checks

- bunx tsc --noEmit: passes.
- git diff --check: passes.
- Full bun test: 179 pass, 2 skip, 17 fail, 1 error. Failures are in terminal/session behavior and board delivery; examples include tmux exit failures/mismatched terminal identifiers and missing session_start handlers for the disabled board extension under BB. No claim of a green suite or baseline comparison.
- scc-delta.sh attempted: unavailable because the scc and jq mise shims have no active versions. No configuration changed to activate them.

## Boundaries

Admission and continuation read the policy at call time. Actual dispatch, integration, compaction/OM handoff, and session retirement remain explicit supervisor actions. Existing route(workflow, task, options) remains available for model-only callers. The historical classify.ts is not the runtime policy source. Reload exec to use the new exports; policy edits need no reload.
