---
stage: idea
assignee: agent
author: "session:01a0eb92-5550-705f-9276-cf2f5bd2244c"
priority: 3
---

Owner: `chrome-devtools-axi` (`~/dev/chrome-devtools-axi`). The Common Concept Session composer is a controlled multiline input. In the local-provider drive, CLI `fill @ref 'I keep reopening the app … 7 × 8.'` showed the entire string in the accessibility snapshot but left **Send** disabled. CLI `type ' please.'` then showed only ` please.` and enabled Send. Filling the long string again showed the long value and enabled Send, but clicking Send submitted ` please.`—the previous state—rather than the visible value. This consumed one live OpenRouter turn with an unintended prompt. The snapshot and the submitted transcript disagreed.

Observed on 2026-09-29 at `http://127.0.0.1:4420/ncept/sessions/session-83dda6c5-9537-495e-9a6c-cbe9cd065e38`, in named session `let-local-convex-reach-providers-through-the-host-proxy-drive`, `chrome-devtools-axi` CLI. Not yet isolated between browser CLI, underlying Chrome DevTools MCP fill, and the Application's controlled input. Workaround: fill, press `End`, press `Space` to dispatch an actual key event, inspect the resulting value and enabled Send, then click. That submitted the visible long prompt. CLI `type` with the long prompt alone left only `× 8.` in the box, so was not a reliable workaround.

A focused reproduction on a small controlled textarea should determine whether `fill` updates the framework's state and whether fast `type` truncation belongs to the CLI or the Application. An agent should not treat a visible filled value or enabled button as proof that the submitted payload matches it.

Owner tracker is unavailable: `gh-axi issue list -R mlegls/chrome-devtools-axi` returned “repository has disabled issues.” This local idea is the durable report until the owner chooses an issue channel.

Drive packet: [[projects/concept/attachments/let-local-convex-reach-providers-through-the-host-proxy/index]].

2026-09-29, usable-seed review: a disposable Playwright replay also filled the Session composer immediately after navigation, then found an empty textarea and disabled Send while the model remained `scripted/tutor`. No message was sent. The existing `say` helper (`test/browser/recorded/plan.start-a-plan.ts`) uses `pressSequentially` and verifies the value before sending; using it successfully sent and reloaded both seeded Sessions ([[projects/concept/attachments/seed-usable-sessions-completed-mission-and-review/index|packet]]). This widens the reproduction beyond the CLI; hydration/draft initialization versus controlled-input event handling remains undiagnosed. Do not attribute it specifically to chrome-devtools-axi from this observation.

Related in this tracker: [[projects/mlegls-pi/issues/chrome-devtools-axi-fill-does-not-enable-controlled-session-send]].
