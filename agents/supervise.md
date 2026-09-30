---
name: supervise
description: Supervisor for an agent-ready issue subtree; delegates its children and integrates them into its branch.
model: openai-codex/gpt-6.1-sol:high, anthropic/claude-opus-5-5:medium
role: supervise
---

`supervise` the issue you're given: start its loop with `ab supervise start` and handle what it wakes you with. You were dispatched by a parent supervisor's loop; it integrates your branch once you end a turn with `done`.
