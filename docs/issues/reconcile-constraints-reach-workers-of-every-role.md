---
stage: "done"
assignee: "agent:auto-routine"
author: "session:thr_ts3gpc75tx"
priority: 2
---
`reconcile_constrain` tells every current worker on the node, whatever its role, so a constraint written for one role reaches another whose brief forbids the work.

Observed in concept on 2026-11-10: the supervisor constrained the `make-large-card-imports-scale-in-one-tutor-script` root to merge main into the tree, meant for the implement worker (@thread:thr_ihbpyrp6s2#msg=26092). The independent drive worker on the same node, which may not read source, had correctly refused that merge, then received the constraint and committed a 44-conflict merge as `83d77456d` in a few minutes, with no checks (@thread:thr_ihbpyrp6s2#msg=26157). The supervisor then had to tell the driver it wasn't its job (#msg=26195). The adversarial review of 2026-11-11 found that merge kept five recordings that differ from main's, against the constraint's own "take main's recording" rule.

Constraints that are product contract belong to every later phase; an instruction for the phase now running belongs only to that phase's worker. Let `reconcile_constrain` take the role (or phase) it addresses, defaulting to all.

## Result

done — Both stories held on replay, and `lib/reconcile/constraints.test.ts` passed. No code repair was needed.

```yaml
commit: 179ab1c6
stories:
  - story: Phase-scoped constraints reach only their addressed phase.
    outcome: held
  - story: Unscoped constraints reach the current worker and carry forward to later phases.
    outcome: held
evidence:
  path: docs/attachments/reconcile-constraints-reach-workers-of-every-role/index.md
  visual: false
  shots: []
tests: []
filed: []
caveats:
  - "Rollout order: land backend 4ddeb0fe, then integrate and load bb-plugins e9911ef (supervision-constraint-phase). The old backend ignores phase and would deliver a scoped instruction node-wide."
```

Evidence: [docs/attachments/reconcile-constraints-reach-workers-of-every-role/index.md](../attachments/reconcile-constraints-reach-workers-of-every-role/index.md)
