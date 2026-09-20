---
name: control-loop
description: "Use when designing, building, or running an unattended iteration loop for a repo."
---

Cybernetics. The human is on the loop, not required at every increment. The
useful distinctions are functional; several parts can be the same program or
agent.

- Sensor: a terminally valuable signal the actuator cannot manipulate directly,
  measured before work and after each increment.
- Controller: chooses a bounded change whose effect can be attributed.
- Stop conditions: the desired result, exhausted budget, lack of progress, or
  a recurring ineffective move (`variety`).
- Memory: learned exclusions, false positives, and feedback that change future
  choices. It enters before the selection it is meant to influence; run logs
  are a different artifact.
- Work in progress: bounded by the capacity to review and integrate it.
- Dampening: something keeps ordinary disturbances from undoing progress,
  such as a regression check on incoming changes.

Design outward from the signal and the actual repo. Agree on the objective,
write authority, cadence, budget, publication policy, and when the human should
be called back (`grilling`). Confirm this before building or launching the loop.
Run each part by hand on a real target before automating their composition.

Deterministic work belongs in scripts and judgment in agents. A stalled loop
may have that boundary wrong. Keep the supervising conversation able to
reconsider both the task and the machinery; the controller is not sacred.

[example-control-loop.md](references/example-control-loop.md) is a specimen.
[github.md](references/github.md) describes the included GitHub PR recipe;
that is one deployment, not a required anatomy for every loop.
[runners.md](references/runners.md) covers runner selection.
