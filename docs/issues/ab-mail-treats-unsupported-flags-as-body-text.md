---
stage: idea
assignee: agent
author: session:01a0f2a3-2187-7441-989b-875a065f0d6b
---

The Concept supervisor sent its completed image-judgment notice using `ab mail wt/mlegls-pi/trial-collected-evidence-and-visual-acceptance --topic trial-collected-evidence-and-visual-acceptance/restart <<'EOF'` followed by the notice on stdin. Board message `muo8fzgr-b9i4mm` at 15:00:51 UTC contained only `--topic trial-collected-evidence-and-visual-acceptance/restart`: those arguments became the message text, so stdin was not read. The observer kept the judgment pending until another supervisor forwarded the actual result at 15:10:59 (`muo8t0rw-7r7pb1`).

Origin: [[projects/mlegls-pi/issues/archive/trial-collected-evidence-and-visual-acceptance]], after names' missing-image request. Sender session `01a0e5e9-67b7-732e-90ce-7e6ac7a4ad76`, tool call `toolu_01PBqHUfg6YB7zYAErMPUZPh`, has the full attempted notice. `ab mail --help` documents stdin input and no `--topic` option; `ab/main.ts` uses TEXT arguments when present and reads stdin only when they are absent. The sender's plain `ab mail TO <<'EOF'` steers reached workers. This is malformed CLI use, not broken stdin support or a dropped correctly addressed body.

The friction is that an unsupported flag-like argument becomes message text without warning, making malformed option syntax look accepted. Explicit TEXT, stdin without TEXT arguments, or the JSON board adapter avoids it; no new messaging system is needed. Separate from [[projects/mlegls-pi/issues/archive/make-undeliverable-mail-status-visible-to-scripts]], which concerns subscriber/delivery status.
