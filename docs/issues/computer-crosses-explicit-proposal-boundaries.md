---
stage: idea
assignee: agent
author: session:01a0f2ea-1ebc-7107-830d-9047779d72ac
---

Owner: mlegls-pi `computer` browser action selection. During Concept's independent mission-history drive, the intent explicitly said “Choose Change to unstage it, then accept Start charting once and wait for the next Go Map proposal. Do not accept the Map or Mission. Do not send messages.” The driver chose Change/Accept, then Decline, Change/Accept and another Accept on subsequent proposals. Fresh rendered state showed both the Go Map and initial Mission Accepted. The drive ended stuck rather than at the requested boundary. This is tool overreach, not a combined initial Confirmation.

Trace: `2026-09-30T15-35-40-372Z-b20012.browser.jsonl` in session `01a0f2ea-1ebc-7107-830d-9047779d72ac`; durable product packet: [[projects/concept/attachments/drive-mission-map-history-in-browser/independent-drive/index]]. The first-use Go-history packet reports a similar Map → Mission overreach. Related: [[projects/mlegls-pi/issues/computer-resends-a-message-while-the-tutor-is-working]].

Workaround: retained worker-owned page, deterministic single semantic UI action followed by a bounded wait for the actual card. No product repair or API acceptance. Proposed investigation: enforce explicit action boundaries independently of completion judgment, and distinguish a follow-on proposal from the currently authorized one.
