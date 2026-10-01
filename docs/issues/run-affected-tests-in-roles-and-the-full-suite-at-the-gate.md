---
stage: idea
assignee: agent
author: "session:01a0f797-f820-7245-8162-31f20d419868"
---

Implement, review and the integration gate each run the project's full suite on every ticket. In the [role time audit](../attachments/role-time-audit/README.md), review was 82% tool time and spent about 120 of its 186 tool minutes in `bun test`, `pre-integrate`, typecheck and browser specs. Implement had already run them, and the reconciler's gate runs `mise run pre-integrate` plus the retained tests (`s.tests`) again at every landing and every conflict retry.

Proposal: a project declares a `test:affected` mise task, like `pre-integrate`. Implement and review run it against their base (`BASE=<rev> mise run test:affected`) when it exists, and existing regressions otherwise. Only the gate runs the full suite. A gate failure already goes back to the warm session, so a regression that `test:affected` missed costs one send-back.

The selection tools already exist: `bun test --changed=<base>` follows the import graph; `playwright test --only-changed=<base>` does too, but only from spec files, so it misses app changes under an unchanged spec. Browser specs should therefore be chosen from the stories a ticket touches (a story → scenario map), not from imports or a hand-written per-ticket list.

Not per-ticket config: the reconciler already accumulates retained tests per branch and the handoff's `tests`.

Touches `agents/roles/implement.md`, `agents/roles/review.md`, and the `pre-integrate` description in `lib/reconcile/checks.ts`. First adopter: [[projects/concept/issues/run-bun-test-in-parallel-and-declare-affected-tests]].
