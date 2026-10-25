---
stage: "ticket"
assignee: "agent"
priority: 2
author: "session:01a17552-1b7e-7143-8b0f-c74b96fd5144"
---
`declaredGates` in [checks.ts](../../lib/reconcile/checks.ts) runs `mise tasks ls --json` in the worker checkout to find the project's `pre-integrate` task, and returns an empty gate list when that command fails (`catch { return []; }`). Integration ([completion.ts](../../lib/reconcile/completion.ts) and [pull-request.ts](../../lib/reconcile/pull-request.ts)) then lands without running the project's declared gate. A broken mise install, an untrusted checkout or an unparsable `mise.toml` therefore turns the integration gate off instead of holding the landing.

Found by concept's adversarial review, 2026-10-25 (@thread:thr_h32qh2dick), where the maintainer accepted "a check that can't run holds landings, with an explicit override" (@thread:thr_h32qh2dick#msg=1317). The concept side, holding landings when verify-main gives no verdict, is [[projects/concept/issues/hold-landings-when-a-gate-cannot-run]].

Ticket:

- When `mise tasks ls` fails or its output doesn't parse, `declaredGates` reports a gate failure naming the command and its stderr, so the landing fails through the existing gate-failure path rather than passing. A project with no mise configuration at all (no `mise.toml` or `.mise.toml`) still has no declared gates.
- Unit test both: a failing `mise tasks ls` fails the gate; a checkout without mise configuration yields no gates.
