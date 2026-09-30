---
stage: idea
assignee: agent
author: session:01a0f0ea-f9f7-7360-b038-1c2fafd0849e
---

During Concept's [[projects/concept/issues/implement-paid-use-billing-and-subscription-states]] drive, `ab computer --browser .wm/drive-3/browser.ts` changed the interface from English to Chinese in Settings and saved, then reported presses of `tab 账单 设置` (steps 3, 11 and 13), but the page remained `#language` on the Language panel. It alternated Language/Billing and stopped `stuck`. A fresh `chrome-devtools-axi` snapshot showed Language still selected; its click on the actual 账单 tab immediately opened Billing. A later Chinese-to-English switch with the same setup completed and opened Billing normally. The product was the packaged Node Application, owned Chromium CDP connection, 1440×1100.

Owner: mlegls-pi computer browser candidate/action targeting. Workaround: inspect fresh state and click the named tab using the Chrome CLI. Cause is not established; don't infer an Application tab defect from action receipts. Original trace: session `01a0f0ea-f9f7-7360-b038-1c2fafd0849e`, `2026-09-30T06-11` computer drive; encounter log [[projects/concept/attachments/implement-paid-use-billing-and-subscription-states/drive-3]].
