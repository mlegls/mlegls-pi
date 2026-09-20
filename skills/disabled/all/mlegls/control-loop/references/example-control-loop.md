# Example: React Doctor

This repository-quality loop uses `react-doctor` as both sensor and much of the
controller. Its metric is a proxy for product quality, not direct evidence of
better user behavior.

## Signal and selection

```sh
bunx react-doctor --project '@codelayer/riptide-ui' --diff false --yes
```

`doctor.config.ts` selects rules and exclusions. The tool returns prioritized
issues; the agent's policy selects a bounded number from the highest-impact
rules. A separate selection script would add little here.

## Actuation and evidence

The agent fixes an issue, identifies a false positive, or leaves it for human
judgment. It checks changes with:

```sh
bun run typecheck
bun run quality
bunx react-doctor --project '@codelayer/riptide-ui' --staged
```

Changing exclusions changes the instrument. Such edits need separate review;
a lower count obtained by ignoring a rule is not a code-quality improvement.
This is a limitation of this specimen, not a reason to conflate actuator and
sensor authority in every loop.

## Review and recurrence

Daily/manual runs create a labeled PR. Scheduled runs wait while one is open;
this example lets manual dispatch bypass that limit. `/iterate` routes review
feedback to the originating workflow using a marker in the PR body.

The agent reads durable feedback before choosing work. Memory contains lessons
such as when an effect-removal rule is a false positive, not the previous run's
log. A separate PR check detects newly introduced issues so ordinary changes
do not immediately reverse the cleanup. That check can begin as advisory while
the team learns whether it is a useful gate.
