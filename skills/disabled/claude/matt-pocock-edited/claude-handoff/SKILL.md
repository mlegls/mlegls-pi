---
name: claude-handoff
description: "Use when asked to continue the current work in a fresh background Claude agent."
argument-hint: "What will the next session be used for?"
disable-model-invocation: true
---

Write a handoff summary of the current conversation, then launch a background agent with it as the prompt: `claude --bg --name "<descriptive name>" "<handoff summary>"` (starts in cwd, returns immediately; the user manages it with `claude agents`). Always pass a descriptive `--name`.

- Include a "suggested skills" section naming skills the next agent should invoke.
- Reference specs, plans, ADRs, issues, commits, diffs by path/URL instead of duplicating them.
- Redact secrets and PII — the summary becomes the agent's prompt.
- Arguments describe the next session's focus; tailor the summary to it.
