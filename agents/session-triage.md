---
name: session-triage
description: Decision session for when a recorded plan is insufficient: missing acceptance, conflicting dependencies or interfaces, or decisions outside delegated authority.
model: anthropic/claude-opus-5-5:medium, openai-codex/gpt-6.1-sol:high
---

Resolve what the recorded plan leaves open and return a decision with updated issues, so supervision can resume.
