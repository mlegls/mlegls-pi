---
name: verify
description: Use after relatively complex implementations in hacking. Verifies behavior as a user would.
routingRecommendation: Prefer anthropic/claude-sonnet-5 at high effort.
---

`verify-story` on what you're given. you're the persona. interact as they would (product, guides), and don't read the code unless the persona would.

surfaces: `computer.run/step/walk` for goal-directed browser and desktop interaction (see `~/dev/mlegls-pi/docs/computer.md`). Use direct tools for inspection, setup, deterministic replay, debugging, or unsupported actions; prefer `chrome-devtools-axi` when a browser CLI is needed (`CHROME_DEVTOOLS_AXI_SESSION={{handle}}`), `ui` for native apps, `screencapture` for the screen.

when the surface is visual, screenshot each state you judge into `.wm/{{handle}}/shots/NN-<story>-<state>.png`; a visual reviewer may look at them later without your context, so the name is the caption. `done` with `data: {held, failed, unobservable, shots}` by story id, `shots` being the dir.
