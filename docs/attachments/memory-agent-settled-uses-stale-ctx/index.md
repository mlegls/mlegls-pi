# Memory hibernation across session replacement — drive

## Predicted before first use (ticket + memory README)

- **Replacement/reload after `agent_settled`:** When a supervisor becomes idle with live children and sufficient tokens, its timer waits for the provider's documented idle interval. Replacing/reloading the session before that timer fires should not throw “This extension ctx is stale after session replacement or reload” and should not compact the replacement session. An old timer is cancelled or becomes inert. The ticket's original failure followed a `turn_end` persistence error; the memory handler should not add a second, stale-context crash.
- **Normal hibernation:** With a settled, eligible supervisor left idle through the documented cache interval, one hibernation checkpoint should still run. Below threshold / without live children / on new activity, no hibernation should run; hibernation policy is unchanged.

The provided entry point is `bun test extensions/memory`; this is a local regression, not a deployment. Tests create temporary fixtures; no persona or authentication is needed. Predictions above are written before running the entry point or inspecting tests/source.

## Setup and observations

Pending drive.
