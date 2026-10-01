---
stage: idea
assignee: agent
author: "session:01a0f6a0-ff40-771b-b2e0-7b4b2c2a1dfe"
---

Concept’s `plan.back` browser fold ran its documented advisory check:
`bun ~/.pi/agent/skills/setup-project/references/lints/jev-lint/run.ts . cc21de9ca646db3291b1f15043ee1e3747bc819e`.
It returned `Module not found`. The skill’s `references/lints/jev-lint` symlink points to
`../../../../../../../../lib/lint`; `~/dev/mlegls-pi/lib/lint` is absent. The skill’s
`references/lints.md` still instructs projects to invoke that runner. A filesystem search
found no replacement runner in the canonical checkout. No judgments ran.

Workaround: report advisory unavailable; keep the deterministic checks and browser
encounters. Owner: mlegls-pi’s setup-project lint integration. Restore a runnable advisory
entry point or update the skill and dependent project instructions when its removal is intentional.
