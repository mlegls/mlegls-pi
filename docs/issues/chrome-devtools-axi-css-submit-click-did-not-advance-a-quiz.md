---
stage: idea
author: session:01a0f55c-50cb-738e-ae1f-9678b884ce45
---

Owner: chrome-devtools-axi browser `run` adapter. During Concept's independent study fixture drive, `run` with `await page.click('main button[type="submit"]')` returned without an error twice on a visible enabled standalone Quiz submit button, but subsequent fresh snapshots still showed the same selected answer and `1 answered, 1 correct · 3 Problems`. Direct Playwright on that same worker-owned CDP page (`getByRole("button", {name:"Submit answer", exact:true}).click()`) advanced it to `2 answered, 2 correct · 3 Problems`. Cause is unestablished: no claim that the two adapters send equivalent events, and no product repair.

Earlier, an unscoped `page.fill('input','6')` hit the hidden Account-name draft rather than the radio answer; it was not saved. This was driver misuse and is not the no-advance claim. Generation-tagged ref refusals were handled by taking fresh snapshots, not replaying potentially completed actions.

Workaround: use exact, visible semantic Playwright actions and wait for the next rendered counter. Product packet [[projects/concept/attachments/fold-study-quiz-and-review-browser-fixtures/index]], standalone path and frames 10–12. Scratch command outputs are in the driver's session logs; they are transient. Reproduce on a new standalone Early arithmetic practice run, answer dots correctly, select 40 on the next radio Problem, issue the CSS click, then inspect whether the second counter advances. Compare with an exact semantic Playwright click only if it did not.
