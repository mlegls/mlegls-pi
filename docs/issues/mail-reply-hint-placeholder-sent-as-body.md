---
stage: ticket
assignee: agent
priority: 3
author: session:01a0f324-32e8-732c-96ad-132d2d15485e
---

Owner: `ab mail`. Every board message ends with `reply: ab mail mail/<id> TEXT`. On 2026-09-30, Concept's repair-checks worker copied it verbatim and sent the body "TEXT". Its correction then arrived truncated and had to be sent again. That is two wasted wakes for the supervisor.

Fix: `ab mail` refuses a body that is exactly the placeholder. Better still, the hint stops looking like a complete command, e.g. `reply: ab mail mail/<id> <message>` or a separate "reply address: mail/<id>" line. Pairs with [[projects/mlegls-pi/issues/ab-mail-treats-unsupported-flags-as-body-text]].

## Result

First-use CLI and live Pi RPC drive: exact `TEXT` refusal, address-only reply hints and real-message compatibility held. [Evidence packet](../attachments/mail-reply-hint-placeholder-sent-as-body/index.md). No rendered UI journey; no product repairs by the driver.
