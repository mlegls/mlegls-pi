---
stage: "done"
assignee: "agent"
priority: 2
author: "session:01a17552-1b7e-7143-8b0f-c74b96fd5144"
---
`declaredGates` in [checks.ts](../../lib/reconcile/checks.ts) runs `mise tasks ls --json` in the worker checkout to find the project's `pre-integrate` task, and returns an empty gate list when that command fails (`catch { return []; }`). Integration ([completion.ts](../../lib/reconcile/completion.ts) and [pull-request.ts](../../lib/reconcile/pull-request.ts)) then lands without running the project's declared gate. A broken mise install, an untrusted checkout or an unparsable `mise.toml` therefore turns the integration gate off instead of holding the landing.

Found by concept's adversarial review, 2026-10-25 (@thread:thr_h32qh2dick), where the maintainer accepted "a check that can't run holds landings, with an explicit override" (@thread:thr_h32qh2dick#msg=1317). The concept side, holding landings when verify-main gives no verdict, is [[projects/concept/issues/hold-landings-when-a-gate-cannot-run]].

Ticket:

- When `mise tasks ls` fails or its output doesn't parse, `declaredGates` reports a gate failure naming the command and its stderr, so the landing fails through the existing gate-failure path rather than passing. A project with no mise configuration at all (no `mise.toml` or `.mise.toml`) still has no declared gates.
- Unit test both: a failing `mise tasks ls` fails the gate; a checkout without mise configuration yields no gates.

## Result

done: the change holds. `declaredGates` now throws when `mise tasks ls --json` can't run, so the landing fails instead of passing.

I made no repairs. `bun test lib/reconcile/checks.test.ts` passes (4 tests, 17 expectations).

- **Failure path:** the error is built from the spawn result and carries `stdout`, `stderr`, `status` and `signal`, and its message names `mise tasks ls --json`. `commandFailure` formats it with the same code as other gate failures.
- **Call sites:** `declaredGates` is called inside the landing preparation at `completion.ts:116` and `pull-request.ts:85`. A throw there takes the existing gate-failure route.
- **No mise configuration:** a checkout with neither `mise.toml` nor `.mise.toml` returns no gates, and `mise` is not run at all.
- **Grouped test case:** the driver asked me to confirm it covers both a failing command and bad output. It does: one script exits 1 with stderr, the other prints stderr and non-JSON. Each case checks that the failure summary contains the command and the stderr text.

Two observations, neither fixed:
- A checkout whose only mise config lives elsewhere (for example `.config/mise.toml` or `mise.local.toml`) now yields no gates. This matches the ticket's wording.
- `declaresSetup` in `lib/thread/setup.ts` still returns false when discovery fails. That is a different decision (whether to run worktree setup), outside this ticket.

```yaml
commit: d1fbd9f9
stories:
  - story: Gate discovery failures hold landing with command diagnostics
    outcome: held
  - story: A checkout without mise configuration yields no declared gates
    outcome: held
evidence:
  path: docs/attachments/declared-gates-pass-when-mise-tasks-cannot-be-listed/index.md
  visual: false
  shots: []
tests:
  - lib/reconcile/checks.test.ts
caveats:
  - "Projects whose mise config is only at .config/mise.toml or mise.local.toml are treated as having no declared gates (ticket specifies mise.toml/.mise.toml)."
  - "lib/thread/setup.ts declaresSetup still swallows discovery failures; different decision, not changed."
```

Evidence: [docs/attachments/declared-gates-pass-when-mise-tasks-cannot-be-listed/index.md](../attachments/declared-gates-pass-when-mise-tasks-cannot-be-listed/index.md)
