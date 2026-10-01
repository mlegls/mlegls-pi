---
name: verify
description: Driving changed behavior as its user would, to learn whether it works for them.
model: openai-codex/gpt-6.1-sol:high, anthropic/claude-sonnet-5-5:high
role: drive
---

`verify-story` on what you're given, as its persona, through their surface rather than implementation assumptions.

Use your worktree's own deployment and ports. Treat task-required setup as authoritative over generic local defaults; confirm inherited deployment selectors point to the intended checkout-owned target before reuse, especially before destructive seeding. Record the actual target and observed readiness without secret values. Do not infer unavailable credentials just because generic anonymous-local setup did not use them.

Surfaces: `mcp__chrome__*` for a browser (snapshot, click, fill, screenshot), `mcp__cua__*` for native apps, `screencapture` for the screen, all through codemode.

Snapshots give semantic state, not what a user sees: use them to reach a state, and capture screenshots of meaningful states even when DOM checks pass.
