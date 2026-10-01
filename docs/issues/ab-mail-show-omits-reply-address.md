---
stage: idea
assignee: agent
author: session:01a0f527-7aa1-7213-97d0-7a36ced26d18
---

Owner: `ab mail --show`. While driving [[projects/mlegls-pi/issues/mail-reply-hint-placeholder-sent-as-body]], I used `--show` to inspect a signed message's reply hint. Help calls its output “full message by id, as wake lines print it,” but the output contained only the header and body, no reply address. The message's board readback included the sender mailbox. See [CLI evidence](../attachments/mail-reply-hint-placeholder-sent-as-body/cli-session.txt), “Show correction as wake lines.”

Observation: the CLI inspection surface does not expose the reply hint. Workaround: receive a signed message in an owned Pi RPC session and inspect its board message content instead. Consider printing the reply address in `--show`, or clarifying the help's parity claim; this is not a claim that the live wake hint is wrong.
