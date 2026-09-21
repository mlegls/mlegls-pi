# Pi worker start confirmation — 2026-09-21

Scope: one-call Pi submission and truthful launch receipts.

- A real Pi print-mode process loaded `extensions/orca/index.ts`, consumed a correlation-marked prompt, wrote the atomic `before_agent_start` evidence, and answered `OK`.
- The importing API `workers.confirmStart` read that evidence as `started`; a missing evidence file returned `unconfirmed`. Blank submission was rejected before creating resources.
- Existing suite: 201 passed, 1 skipped, 0 failed. Typecheck and diff checks passed.
- A full Orca create/enroll/settle loop was not repeated. Native injection reliability, remote confirmation, and task-ID-only correlation remain unverified or unsupported; native readiness alone never promotes the receipt to started.

The confirmation proves entry into a correlated Pi turn, not model response success or continuing liveness. Temporary evidence files remain available for later inspection.
