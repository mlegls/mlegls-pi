---
stage: done
author: session:01a0f242-7603-76bd-9e3c-706b0801c1e6
part-of: "[[projects/mlegls-pi/issues/tracker-obsidian-rollout]]"
---

LIVE.md's isolated-HOME recipe opens the real Base in Restricted mode on a fresh profile. Tracker shows “Unknown view type: tracker”, including after the documented `plugin:reload` reports success. `plugins:restrict` says `on`; Settings → Community plugins offers “Exit Restricted mode”. The enabled-plugin list still includes tracker, which is not proof it loaded.

Observed during the independent live drive on 9e7f811. [Screenshots and replay](../../attachments/tracker-obsidian-rollout/drive/index.md). Stopped the owned instance without approving its security prompt and reused the already-trusted regular instance with an exclusively created window. The recipe should account for fresh-profile plugin trust explicitly; approval remains an owner decision, not a hidden profile mutation.

Resolved in review: `plugins:restrict off` on the scratch profile's CLI reloads plugins; Tracker then loads and the live Base renders. LIVE.md now states the Restricted-mode step and marks it as the owner's trust decision.
