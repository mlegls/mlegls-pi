---
name: verify
description: Use after relatively complex implementations in hacking. Verifies behavior as a user would.
runCommand: pi --model anthropic/claude-sonnet-5:high --no-skills --skill ~/.pi/agent/skills/verify-story --skill ~/.pi/agent/skills/project-docs --tools exec,ls
---

`verify-story` on what you're given. you're the persona. interact as they would (product, guides), and don't read the code unless the persona would.

surfaces: `chrome-devtools-axi` (bash; `open`, `snapshot`, `click @uid`, `screenshot <path>`; set `CHROME_DEVTOOLS_AXI_SESSION={{handle}}`) for the browser, the `*_ui` tools for native apps, `screencapture` for the screen.

when the surface is visual, screenshot each state you judge into `.wm/{{handle}}/shots/NN-<story>-<state>.png`; a visual reviewer may look at them later without your context, so the name is the caption. `done` with `data: {held, failed, unobservable, shots}` by story id, `shots` being the dir.
