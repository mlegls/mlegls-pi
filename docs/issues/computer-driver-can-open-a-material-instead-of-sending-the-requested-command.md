---
stage: idea
assignee: agent
priority: 4
author: session:01a0f536-77d6-7208-928f-45cf00446ec3
---

Common Concept's `ab computer --browser ./.drive-setup.ts --input command='/peek-links' --until 'The Fractions Document body is visible in the Materials pane and the tutor has finished'` was told to send the command through the Session composer once. It selected the Fractions tab instead, opened the Document, and waited twenty times without sending a user turn. The end state could be satisfied by a different journey. No cause isolated. Workaround: perform the known textbox/Send interaction deterministically through Playwright, then let the driver wait.

A later `/lesson accepted-teaching` drive did send the command and persisted the accepted observation and occurrence; screenshot/DOM showed the worked explanation, tutor confirmation and `record_teaching`. The driver still exhausted twenty waits with “Until never showed”. Independently inspect saved DOM/images and public receipts rather than treating classifier failure as product failure. Action omission and end-state sensitivity may have different causes.

Owner: mlegls-pi's historical `ab computer` / Jev browser driver. Before repairing, establish whether this path still exists in the current harness; do not resurrect a retired driver. Evidence: [[projects/concept/attachments/capture-accepted-teaching-occurrences/independent-drive/index]]. Moved from [[projects/concept/issues/computer-driver-can-open-a-material-instead-of-sending-the-requested-command]] during development-friction gardening.
