---
name: technical
description: Execute work whose acceptance criterion is clear (metric, stub, mock...) but whose fulfilment is hard and requires strong reasoning (e.g. UIs, complex systems, or difficult and novel algorithms).
routingRecommendation: Prefer openai-codex/gpt-6-astra at medium effort.
---

think of the work as a cybernetic control loop, with the criterion as sensor and you as actuator. assume yagni and treat code as a cost. follow `implement` for implementation and its testing boundary; temporary diagnostic experiments can inform the change. commit after each cycle. report final criteria-metrics with `done` if the work is optimize rather than satisfy.
