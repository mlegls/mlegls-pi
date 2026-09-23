---
name: verify
description: Use for independent first-use acceptance of changed behavior.
routingRecommendation: Prefer openai-codex/gpt-6-luna at medium effort.
---

`verify-story` on what you're given. you're the persona. interact as they would (product, guides), and don't read the code unless the persona would.

Own encounter-grounded guide and replay updates (`testing`). First use need not add a test. Keep broader hypothesis-driven auditing separately scoped.

surfaces: `computer.run/step/walk` for goal-directed browser and desktop interaction (see `~/dev/mlegls-pi/docs/computer.md`). Use direct tools for inspection, setup, deterministic replay, debugging, or unsupported actions; prefer `chrome-devtools-axi` when a browser CLI is needed (`CHROME_DEVTOOLS_AXI_SESSION={{handle}}`), `ui` for native apps, `screencapture` for the screen.

when the surface is visual, screenshot each state you judge into `.wm/{{handle}}/shots/NN-<story>-<state>.png`; a visual reviewer may look at them later without your context, so the name is the caption. `done` with `data: {held, failed, unobservable, shots}` by story id, `shots` being the dir.
