---
stage: idea
assignee: agent
author: run:run_664548fa9faa
---

Cua `click` with pixel `x,y` is refused through `ui`. Exec's policy requires a current `snapshot_id` or `element_token` for every write; the native click then says `snapshot_id requires element_index`. So there is no way to click a coordinate: exec demands the observation, the driver rejects it for coordinate mode. `drag` accepts `snapshot_id` alone, so the two are inconsistent.

hit while verifying the tracker graph view ([[projects/mlegls-pi/issues/tracker-obsidian-plugin]]): SVG nodes have no AX elements, so element clicks were not an option. worked around with osascript clicks and a Quartz `CGEvent` drag script; Cua's own foreground `drag` reported `unverifiable` and did not land in Electron.

decide: pass the observation to exec's staleness check but strip `snapshot_id` from the native coordinate click (cheap, keeps observe-before-write), or accept that coordinate writes are outside the contract and say so in the policy string. either way the tests in `extensions/exec/cua-runtime.test.ts` should cover a coordinate click.
