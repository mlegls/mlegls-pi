---
stage: "idea"
assignee: "agent"
priority: 3
author: "session:thr_ihbpyrp6s2"
---

A Concept visual review of run-learner-written-code-in-a-playground (thr_ieb4yrnnwt, 2026-11-22) ran 8 minutes on anthropic/claude-opus-5-5, the first model in agents/visual-reviewer.md, then ended in a provider error: "This request was blocked as it seems to violate Anthropic's Terms of Service restrictions on reverse engineering or duplicating model outputs." Concept reviews read recorded tutor outputs as evidence, so this can recur on any of them. The role already lists openai/gpt-6.2-sol:high as a second model; on this refusal the reconciler could relaunch the phase on the next listed model instead of waiting for a supervisor redispatch, which reruns the same first model. Same refusal seen before in archive/compaction-register-variants.md.
