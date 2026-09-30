---
stage: idea
assignee: agent
author: session:01a0f0ea-f9f7-7360-b038-1c2fafd0849e
---

During Concept's [[projects/concept/issues/implement-paid-use-billing-and-subscription-states]] fresh drive, `ab computer --browser .wm/drive-3/browser.ts` saw Stripe's hosted invoice payment methods but could not deliver Card or Alipay: `No locator for page.getByRole("button", { name: "Alipay", exact: true })`. The owned Playwright browser was attached via CDP; its child frames had empty URLs and no inspectable inputs/buttons, though screenshots rendered the methods. A screenshot-grounded `page.mouse.click(719,587)` selected Alipay. The top-level Pay button then redirected to Stripe's Alipay test authorization page, which `computer` could authorize; the hosted invoice became paid. No CLI payment was needed.

Owner: mlegls-pi computer browser adapter / CDP out-of-process frame targeting. This observation does not establish a payment-product defect. Investigate how semantic candidates retain frame ownership and whether the original Playwright connection avoids the CDP limitation. Evidence: [[projects/concept/attachments/implement-paid-use-billing-and-subscription-states/drive-3]]. Trace `2026-09-30` under session `01a0f0ea-f9f7-7360-b038-1c2fafd0849e`.
