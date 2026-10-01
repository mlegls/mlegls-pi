---
stage: done
assignee: agent
author: session:01a0f0ea-f9f7-7360-b038-1c2fafd0849e
---

During Concept's [[projects/concept/issues/implement-paid-use-billing-and-subscription-states]] drive, `ab computer --browser .wm/drive-3/browser.ts` changed the interface from English to Chinese in Settings and saved, then reported presses of `tab 账单 设置` (steps 3, 11 and 13), but the page remained `#language` on the Language panel. It alternated Language/Billing and stopped `stuck`. A fresh `chrome-devtools-axi` snapshot showed Language still selected; its click on the actual 账单 tab immediately opened Billing. A later Chinese-to-English switch with the same setup completed and opened Billing normally. The product was the packaged Node Application, owned Chromium CDP connection, 1440×1100.

Owner: mlegls-pi computer browser candidate/action targeting. Workaround: inspect fresh state and click the named tab using the Chrome CLI. Cause is not established; don't infer an Application tab defect from action receipts. Original trace: session `01a0f0ea-f9f7-7360-b038-1c2fafd0849e`, `2026-09-30T06-11` computer drive; encounter log [[projects/concept/attachments/implement-paid-use-billing-and-subscription-states/drive-3]].

Reproduced on the next wording re-drive, session `01a0f135-a6b0-73ae-ad09-19385dfaa994`, packaged Concept at `313ea9e3`, fresh Cloud `sleek-frog-640`, owned CDP 9425. Trace `2026-09-30T07-31-41-891Z-664ed6.browser.jsonl`: steps 3/11/13 again reported 账单 presses, final URL `#language` and Language still selected. A direct Playwright named-tab click opened Billing. Same workaround; no product repair. Packet [[projects/concept/attachments/implement-paid-use-billing-and-subscription-states/drive-5]].

Independent Concept credit-return drive (`ec748e220`, session `01a0f200-19ff-73bf-8458-7246bd2642b5`) reproduced this after Chinese → English Save: trace `2026-09-30T11-23-09-063Z-ab2c1d.browser.jsonl` reported Billing at steps 3/11/13, alternated Language and Billing, and stopped in `#language`. Fresh DevTools showed Language selected and the chosen English radio saved. Direct DevTools click on the fourth rendered tab opened Billing immediately; the same Checkout/Session/turn parameters and credited receipt survived. Packet [[projects/concept/attachments/implement-credit-exhaustion-checkout-return/drive/index]], screenshots 10–12. No product repair or resend.

disposition, 2026-09-30: kept as evaluation evidence for [[projects/mlegls-pi/issues/archive/buy-a-computer-use-driver]]; the Jev driver's judgment layer is bought, not fixed here.
