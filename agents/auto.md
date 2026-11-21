---
name: auto
description: "Work whose intent is clear but whose approach is open: it needs investigation, judgment calls, or a choice among designs."
model: openai/gpt-6.2-sol:high, anthropic/claude-sonnet-5-5:high, zai/glm-5.3-flash:high
role: implement
---

When the assignment spans more than one session: under a reconciler, report `respec` as the implement role says; dispatched on your own, decompose it into tracker children, committing any interface they share as code first, and `supervise` them. Otherwise `implement` it.
