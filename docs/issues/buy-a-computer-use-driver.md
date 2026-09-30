---
stage: idea
assignee: human
priority: 3
author: session:01a0f065-abaf-776c-bc8b-419cb9b312e4
---

Buy, not build, the judgment layer of `ab computer`. The Jev decision driver (`computer.run/step/walk`) keeps getting completion and candidate judgments wrong: it reports stuck when the goal is visibly met, loops on an action that already landed, misses navigation candidates that are on screen, crosses explicit stop instructions, and hits `max_tokens_exceeded` on large native accessibility trees. Many teams are working on exactly this, so we won't calibrate our own driver. Instead, adopt an off-the-shelf one when it drives our first-use stories better.

Decision, 2026-09-30 (user): "better to buy when available. i think there are a lot of ppl working on this". The manual LLM path (`cua-driver` for native, `chrome-devtools-axi` or Playwright for browsers) is the default meanwhile; the Jev driver stays optional.

Candidates to watch: Stagehand's agent (DOM, hybrid and CUA tool modes), browser-use, the trycua agent SDK over the `cua-driver` we already run, Agent S3, UI-TARS, and the provider computer-use models (Anthropic, OpenAI, Gemini). Evaluate a candidate by replaying these recorded encounters, each of which has a trace and an independently observed ground truth:

- [[projects/mlegls-pi/issues/archive/browser-driver-repeats-keep-print-link-instead-of-navigating]]
- [[projects/mlegls-pi/issues/archive/browser-driver-skips-hover-only-fork-before-sending]]
- [[projects/mlegls-pi/issues/archive/browser-driver-stuck-on-storybook-navigation]]
- [[projects/mlegls-pi/issues/archive/computer-browser-crosses-stop-before-naming-instruction]]
- [[projects/mlegls-pi/issues/archive/computer-rejects-formatted-card-input-after-successful-fill]]
- [[projects/mlegls-pi/issues/archive/computer-reports-tab-press-without-opening-the-tab]]
- [[projects/mlegls-pi/issues/archive/computer-obsidian-base-semantic-drive]]
- [[projects/mlegls-pi/issues/archive/computer-obsidian-vault-chooser-native-drive]]
- [[projects/mlegls-pi/issues/archive/mlegls-pi-computer-native-safari-repeats-completed-actions]]
- [[projects/mlegls-pi/issues/archive/narrow-ax-intent-candidate-discovery]]
- [[projects/mlegls-pi/issues/archive/planning-input-drive-computer-friction]]
- [[projects/mlegls-pi/issues/archive/computer-drive-refused-by-typesafe-credit-exhaustion]]
- [[projects/mlegls-pi/issues/archive/cua-background-compatibility]]
- [[projects/mlegls-pi/issues/browser-driver-declines-completed-source-release-navigation]], [[projects/mlegls-pi/issues/computer-cannot-target-stripe-payment-iframe]], [[projects/mlegls-pi/issues/computer-driver-omits-materials-navigation-candidates]], [[projects/mlegls-pi/issues/computer-safari-decision-api-max-tokens]], and the same class filed later by Concept drives.

New frictions with the Jev driver's judgments belong here as evidence, not as separate fixes.

2026-09-30, Concept's [[projects/concept/attachments/repair-checks-left-red-on-main/index|repair-checks drive]]: `ab computer --browser ./.wm/catalog-drive.ts` opened Landing / Techniques → Objects in isolated Chromium, waited three times, then pressed **Light or dark ground light** twice. The first press opened its listbox; the second timed out because the modal body intercepted pointer events. It returned `stuck` rather than selecting the visible dark option. A named `chrome-devtools-axi` session selected dark and hue 60 and completed reload; both paints matched. Trace: `~/.pi/agent/sessions/--Users-mlegls-dev-mmon-concept__worktrees-repair-checks-left-red-on-main-drive--/2026-09-30T17-34-55-016Z_01a0f362-3628-714a-a0cd-cce4046b272e.ab/computer/2026-09-30T17-37-39-139Z-2b4f3c.browser.jsonl`. No product repair or driver diagnosis attempted.
