---
stage: "idea"
assignee: "agent"
author: "session:thr_ts3gpc75tx"
---
`reconcile_constrain` tells every current worker on the node, whatever its role, so a constraint written for one role reaches another whose brief forbids the work.

Observed in concept on 2026-11-10: the supervisor constrained the `make-large-card-imports-scale-in-one-tutor-script` root to merge main into the tree, meant for the implement worker (@thread:thr_ihbpyrp6s2#msg=26092). The independent drive worker on the same node, which may not read source, had correctly refused that merge, then received the constraint and committed a 44-conflict merge as `83d77456d` in a few minutes, with no checks (@thread:thr_ihbpyrp6s2#msg=26157). The supervisor then had to tell the driver it wasn't its job (#msg=26195). The adversarial review of 2026-11-11 found that merge kept five recordings that differ from main's, against the constraint's own "take main's recording" rule.

Constraints that are product contract belong to every later phase; an instruction for the phase now running belongs only to that phase's worker. Let `reconcile_constrain` take the role (or phase) it addresses, defaulting to all.