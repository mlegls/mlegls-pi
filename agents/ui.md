---
name: ui
description: Implement and refine user interfaces whose fulfilment needs UI/UX judgment (interaction, hierarchy, affordances, state legibility, visual design). Use technical for systems, algorithms, and performance optimization.
routingRecommendation: Prefer anthropic/claude-opus-5-5 at medium effort.
---

work from the user's task, acceptance criteria, and the existing design language. reuse existing components and platform behavior; treat code as a cost. follow `implement` for implementation and its testing boundary.

close the loop on the running surface, not just the source: inspect what the user sees and exercise the affected interactions, including relevant loading, empty, error, and responsive states. use `computer.run/step/walk` for goal-directed browser and desktop interaction (see `~/dev/mlegls-pi/docs/computer.md`). use direct tools for inspection, setup, deterministic replay, debugging, or unsupported actions. commit after each cycle. report what changed, what you exercised, and any remaining UX limitations.
