---
stage: idea
assignee: agent
author: session:01a0f2a3-2187-7441-989b-875a065f0d6b
---

The Concept supervisor sent its completed image-judgment notice using `ab mail wt/mlegls-pi/trial-collected-evidence-and-visual-acceptance --topic trial-collected-evidence-and-visual-acceptance/restart <<'EOF'` followed by the notice on stdin. Board message `muo8fzgr-b9i4mm` at 15:00:51 UTC contained only `--topic trial-collected-evidence-and-visual-acceptance/restart`. The body was silently ignored. The observer kept the judgment pending until another supervisor forwarded the actual result at 15:10:59 (`muo8t0rw-7r7pb1`).

Origin: [[projects/mlegls-pi/issues/trial-collected-evidence-and-visual-acceptance]], after names' missing-image request. Sender session `01a0e5e9-67b7-732e-90ce-7e6ac7a4ad76`, tool call `toolu_01PBqHUfg6YB7zYAErMPUZPh`, has the full attempted notice. This is malformed CLI use, not evidence that the board dropped a correctly addressed body: `ab mail TO TEXT` takes the body as an argument, and `--topic` is not a mail option. A real subscriber was reading the stored messages.

The existing body argument or JSON board adapter avoids it; no new messaging system is needed. The friction is that unsupported flags become text and stdin is ignored without telling the sender what was sent. Separate from [[projects/mlegls-pi/issues/make-undeliverable-mail-status-visible-to-scripts]], which concerns subscriber/delivery status.
