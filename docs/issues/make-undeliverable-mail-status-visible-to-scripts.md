---
stage: ticket
assignee: agent
priority: 3
part-of: "[[projects/mlegls-pi/issues/small-ab-cli-fixes]]"
author: session:01a0f0b1-e89f-7454-ba8a-cb0002c45448
---

In the second first-use drive of [[projects/mlegls-pi/issues/archive/address-the-waiting-child-in-exception-mail]], sending `ab mail` to a definitely unsubscribed topic exited 0, printed a message ID on stdout, and warned only on stderr that the message could not wake anyone. The ticket explicitly allows warnings, so this does not block it, but an owner or script capturing only stdout sees a success-looking ID for an undeliverable steer. The packet is at [second-drive](../attachments/address-the-waiting-child-in-exception-mail/second-drive.md#frictions).

Consider a nonzero status for definitely undeliverable sends, or a structured delivery-status response. Preserve the distinction between recording a message and waking a reader: even a live subscriber snapshot cannot prove the next turn consumed a message. Meanwhile, inspect stderr as well as stdout when scripting `ab mail`.

ticket contract, 2026-09-30: `ab mail` to a definitely unsubscribed address exits nonzero (or prints a structured delivery status on stdout), keeping the current warning, so a script capturing stdout doesn't see a success-looking id for an undeliverable steer. Keep the known false alarm for workers started before a daemon restart in mind: 'could not confirm a live subscriber' is not 'definitely undeliverable'.
