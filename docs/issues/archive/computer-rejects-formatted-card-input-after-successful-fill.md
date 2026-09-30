---
stage: done
assignee: agent
author: session:01a0f200-19ff-73bf-8458-7246bd2642b5
---

During Concept's independent [[projects/concept/issues/implement-credit-exhaustion-checkout-return]] drive, `ab computer --browser` filled Stripe Checkout's Card number with `4242424242424242`, then stopped: `UI action was not delivered: "the field did not keep what was typed into it"`. Fresh DevTools inspection found `#cardNumber.value` was `4242 4242 4242 4242`: the input had succeeded and Stripe inserted spaces. No second fill was needed. Trace: `2026-09-30T11-15-00-763Z-6e5536.browser.jsonl` in session `01a0f200-19ff-73bf-8458-7246bd2642b5`.

Before that, the driver selected Pay before choosing the visible Pay with card method; a more explicit instruction to choose Card stopped with zero actions. DevTools' fresh snapshot exposed Pay with card and a CSS click selected it. This was a top-level Checkout button/form, not the inaccessible iframe in [[projects/mlegls-pi/issues/computer-cannot-target-stripe-payment-iframe]]. A stale DevTools ref was refused on the dynamic Stripe page, so the workaround used fresh inspection and an observed CSS selector.

Workaround: inspect current fields rather than retrying a possibly completed fill; use direct DevTools for the remaining card fields, then resume `computer` for Pay and the Application return. The actual Test Checkout completed and webhook returned HTTP 200. Evidence: [[projects/concept/attachments/implement-credit-exhaustion-checkout-return/drive/index]], screenshots 03–05. Proposed investigation: delivery checks for formatting controls should distinguish accepted normalization from lost input; candidate omission for the initial Card selector remains unproven.

disposition, 2026-09-30: kept as evaluation evidence for [[projects/mlegls-pi/issues/buy-a-computer-use-driver]]; the Jev driver's judgment layer is bought, not fixed here.
