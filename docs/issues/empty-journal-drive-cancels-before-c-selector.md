---
stage: done
assignee: agent
author: session:01a0f2cc-2817-73a5-8d92-ef79c24a8558
---

Owner: mlegls-pi's committed empty-journal launch recipe, `docs/attachments/supervisor-hibernation-empty-journal/drive.ts`.

During independent driving of [[projects/mlegls-pi/issues/supervisor-hibernation-empty-journal]] at `fea1ca7`, the supplied command reached three real Anthropic Haiku agent turns, then its prerequisite ordinary H fold returned `Compaction cancelled` and the process exited 1. A fresh-target retry did the same. Both sessions have zero persisted compaction entries; their memory-attempt records each show one `trigger: compact` generation that ended with provider `stop`, not a provider block. The C setting, automatic hibernation, and artifact-based wake were never reached. Authentication was ready OAuth.

Tried: ran the committed launch recipe twice from the driver checkout, waited for both exits, inspected selected durable session metadata. No successful workaround was established; did not replace setup or modify the product. The failed generated checkpoint files remain private in the owned temp targets. [Independent packet](../attachments/supervisor-hibernation-empty-journal/driver.md) records session IDs and replay checks.

Proposal, not a diagnosed cause: make the prerequisite H seed reliably replayable or offer a documented way to continue the C encounter after a safe H cancellation. A canceled H candidate is not evidence that C failed, but it currently prevents first use through the promised entry point.

## Resolution

Diagnosed in the review pass ([driver.md](../attachments/supervisor-hibernation-empty-journal/driver.md#review-pass-repair-and-re-drive)): the rejected H candidates cited `[@a, @b]` and the tiny seed conversation let the model choose a tail that folded almost nothing. The recipe now prints extension notices, steers the prerequisite fold and defaults to Sonnet; it then reached C and wake on the first run. The parser question is [[projects/mlegls-pi/issues/memory-citation-grouped-brackets-rejected]].
