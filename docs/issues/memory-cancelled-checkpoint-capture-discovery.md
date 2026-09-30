---
stage: idea
author: session:01a0f092-4dab-7095-bfbf-3ca7a2c20806
---

During the first-use drive of [[projects/mlegls-pi/issues/archive/memory-checkpoint-cites-retained-tail]], Pi RPC `compact` received a real DeepSeek Flash checkpoint with `tail: 30bcd26f` and only citations inside that tail. Pi canceled the compaction (`success: false`, `Compaction cancelled`), correctly leaving all 38 entries and no compaction entry. The Memory README says “Blocked checkpoints also save `memory-checkpoint-*.json`, containing both request variants and generation options.” In this checkout-owned session directory, there was no `memory-checkpoint-*.json`; the rejected text was saved instead as `memory-failed-01a0f097-7bbc-75a3-8c7d-5ea05f4264da-1790742883744.md`.

Tried: looked for the documented JSON in the owned `.wm/memory-drive/sessions/` directory after the RPC cancellation. Result: no JSON; the Markdown file contained the candidate. Workaround: inspect the private `memory-failed-*.md` locally, without committing the full session text; the source IDs and status are recorded in [the drive packet](../attachments/memory-checkpoint-cites-retained-tail/index.md).

Possible improvement: document which failure classes write Markdown versus JSON, or make the documented JSON available for rejected candidates if it is meant to be universal. The observed mismatch does not establish that all blocked checkpoints behave this way.
