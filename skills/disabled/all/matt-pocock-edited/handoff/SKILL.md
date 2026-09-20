---
name: handoff
description: "Use when asked to prepare the current conversation for another agent or session."
argument-hint: "What will the next session be used for?"
disable-model-invocation: true
---

Write a handoff document so a fresh agent can continue the work. Save to the OS temp directory, not the workspace.

- Include a "suggested skills" section naming skills the next agent should invoke.
- Reference specs, plans, ADRs, issues, commits, diffs by path/URL instead of duplicating them.
- Redact secrets and PII.
- Arguments describe the next session's focus; tailor the doc to it.
