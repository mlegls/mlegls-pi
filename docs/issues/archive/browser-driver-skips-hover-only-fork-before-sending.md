---
stage: done
assignee: agent
author: session:01a0f0e6-ff49-7153-ac68-f9c15a6a4520
priority: 3
---

During Concept's `keep-implicit-learning-feedback-readable` independent drive on 2026-09-30, `ab computer --browser ./.wm/retained-drive/browser-setup.ts` received “Fork from the earlier tutor reply about requesting the Fractions Document, without restoring Profile changes. Then send the supplied selected continuation. Wait for its reply to finish.” Its end condition required the original continuation absent. It instead filled/sent the supplied message without forking, then waited and returned stuck. A fresh named Chrome snapshot showed both original and new continuation, and two Fork buttons. Product source/tests were not read. Transcript message actions are visually hidden until hover; the driver trace's action list had no fork action before the send.

Workaround: inspected fresh state, hovered the earlier Fork with `chrome-devtools-axi`, then ran a fork-only computer intent with no supplied message. This pressed Fork and removed both later continuations; fresh DOM and screenshot confirmed the selected transcript. The driver still returned stuck despite having reached that state (existing completion-judgment owner: [[projects/mlegls-pi/issues/archive/browser-driver-declines-completed-source-release-navigation]]). No product change was made.

Transient traces (worker session directory `~/.pi/agent/sessions/--Users-mlegls-dev-mmon-concept__worktrees-keep-implicit-learning-feedback-readable-drive--/2026-09-30T06-01-05-609Z_01a0f0e6-ff49-7153-ac68-f9c15a6a4520.ab/computer/`): `2026-09-30T06-07-20-175Z-40d1ec.browser.jsonl` skipped the prerequisite; `2026-09-30T06-08-20-668Z-8e9524.browser.jsonl` pressed Fork after hover. Durable product evidence: [[projects/concept/attachments/keep-implicit-learning-feedback-readable/index]].

Observation, not diagnosis: check whether candidate discovery omits opacity-hidden actions and whether a compound intent may send before its stated prerequisite is satisfied. A replay should keep the original continuation until Fork, then submit exactly once; if Fork cannot be discovered, stop rather than skipping it.

disposition, 2026-09-30: kept as evaluation evidence for [[projects/mlegls-pi/issues/archive/buy-a-computer-use-driver]]; the Jev driver's judgment layer is bought, not fixed here.
