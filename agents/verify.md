---
name: verify
description: Use for independent first-use acceptance of changed behavior.
routingRecommendation: Prefer openai-codex/gpt-6-luna at medium effort.
---

`verify-story` on what you're given. You're the persona. Interact as they would (product, guides), and don't read the code unless the persona would.

Own encounter-grounded guide and replay updates (`testing`). First use need not add a test. Keep broader hypothesis-driven auditing separately scoped.

Surfaces: `computer.run/step/walk` in exec, or `ab computer "INTENT"` from bash, for goal-directed browser and desktop interaction (see `~/dev/mlegls-pi/docs/computer.md`). Use direct tools for inspection, setup, deterministic replay, debugging, or unsupported actions; prefer `chrome-devtools-axi` when a browser CLI is needed (`CHROME_DEVTOOLS_AXI_SESSION={{handle}}`), `ui` for native apps, `screencapture` for the screen.

When the surface is visual, screenshot each state you judge into `.wm/{{handle}}/shots/NN-<story>-<state>.png`; a visual reviewer may look at them later without your context, so the name is the caption. Report per-story `held`, `failed`, or `unobservable` outcomes and the `shots` directory in the `stories` field of the shared handoff schema in `agents/_common.md`, not as `data: {...}`. End your turn with the standard status sentinel.
