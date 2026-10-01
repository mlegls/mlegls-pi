---
stage: done
assignee: agent
author: session:01a0f228-0d53-707d-be6c-a6c111099efd
---

Obsolete 2026-10-01: `ab computer` and its Jev decision driver were deleted in the pi 0.99 rebuild (`4b79baa`). Computer use is the `cua` and `chrome` MCP servers now ([[projects/mlegls-pi/issues/archive/buy-a-computer-use-driver]]).

Owner: mlegls-pi `computer` browser selection. In Concept's [[projects/concept/issues/record-goal-change-and-new-evidence-map-history]] independent drive, the intent “Change default chat model to the tutor model from provider history-go and save” repeatedly replaced the same combobox with `history-go`, then `tutor`, without selecting the provider option. It stopped after seven actions as “Repeated action in unchanged UI”; the model stayed unchanged. The rendered picker explains “Choose a provider, then a model”.

Trace `2026-09-30T12-01-03-286Z-a7dd80.browser.jsonl` in session `01a0f228-0d53-707d-be6c-a6c111099efd`. Workaround being tried: explicitly say to click the provider result before entering the model filter. Evidence: [[projects/concept/attachments/record-goal-change-and-new-evidence-map-history/index]]. This does not establish a product picker defect. Investigate whether the driver's choices preserve the hierarchical picker state or require unusually explicit action wording.

The explicit click-provider retry selected the provider but still clicked Change provider instead of the typed model option, ending stuck. A direct owned Playwright semantic snapshot exposed `option "tutor Use typed model ID"` during a catalog failure, and `option "tutor"` when the catalog subsequently loaded. Its first direct Save was refused with the retained Settings draft (precise technical cause not captured). Task-required setup was completed through authenticated public `settings:update` at the observed version; fresh public `settings:read` confirmed both assignments. This separates the picker-choice friction from the product's known cold-operation readiness issue.

The naming-ticket drive repeated provider/model-filter confusion for OpenRouter's `openai/gpt-5-mini`; an explicit OpenRouter-provider retry selected the provider but then exceeded the decision token limit on its catalog. Direct semantic filtering and exact option selection worked. [[projects/concept/attachments/name-things-by-their-names-not-ids/index|Packet]], trace `2026-09-30T14-03-27-694Z-26de61.browser.jsonl` and retry `2026-09-30T14-04-33-565Z-86f058.browser.jsonl`, session `01a0f28a-fd13-73f4-ac4e-7f65ac17ee20`.
