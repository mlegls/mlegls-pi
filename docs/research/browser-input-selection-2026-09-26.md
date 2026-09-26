# Browser input selection — September 26

The code went into Email during a transition: Email was already filled and the button said “Sending code…”. The selector treated the next expected step as the current field's purpose. Its original choice probability was 0.44 versus 0.35 for wait. Source: session `01a0dcd4-0439-7190-9c55-0aa636998bd6`, trace `2026-09-26T08-33-16-576Z-33a975.browser.jsonl`, event 7.

The CLI also advertised a parent text resolver but passed a callback that always returned undefined. That nonexistent capability is removed. Library callers can still supply a real resolver. The browser selector now explicitly matches text to the currently visible field's purpose and waits for the intended field during a submitting/loading transition; input names need not exactly match labels. No label filter, confidence threshold or automatic credential mapping was added.

## Decision replay

The current runner reconstructed requests from retained observations and preceding events for steps 5 (empty Email), 6 (filled Email, Continue available), and 7 (Sending code). A local stub captured those requests without executing UI actions. Each was then sent to Jev through `lib/decide.ts` in three variants: original, resolver omitted, and resolver omitted plus current-field guidance. This is request reconstruction, not a retained original wire request or a replay of the live application.

| State | Original | No resolver | No resolver + guidance |
| --- | --- | --- | --- |
| Empty Email | Email input, .73 | Email input, .94 | Email input, .96 |
| Filled Email | Continue, .98 | Continue, .98 | Continue, .99 |
| Sending code | Code into Email, .41 | Wait, .64 | Wait, .74 |

Two synthetic controls with the revised request selected the expected input: “One-time passcode” selected Verification code (.95); input named “Account address” selected Email (.96). The controls changed the visible field/text or input name in the reconstructed request; they are not application encounters.

[Recorded states, questions and answers](../attachments/browser-input-replay-2026-09-26.json) retain all eleven requests through indexed state/question tables. Each result's `state` and `questions` index those tables; pass that pair to `decide` to repeat a live evaluation. Values are the original public test credentials. Probabilities are choice distributions, not calibrated reliability estimates; each variant was evaluated once. The revised Sending-code request still assigned .15 to the wrong input. No claim of eliminating wrong-field choices follows.

## Checks and limits

`bun test ab/computer.test.ts lib/computer/runner.test.ts`: 13 passed. The new CLI regression inspects the actual request: no resolver capability/action when none exists, explicit current-field guidance, and missing-input termination. This deterministic test checks the harness contract, not model judgment accuracy.

No live Clerk sign-in was attempted. Existing `--browser` project authentication remains the way to avoid retesting sign-in for unrelated product journeys. Existing `beforeAction` remains available to callers needing approval or denial of mutations; these changes do not introduce a safety gate for arbitrary forms.
