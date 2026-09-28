---
stage: idea
author: "session:01a0e61e-eeff-75df-ba24-e8cbff20ba81"
---

While driving Common Concept's Session at 390×844 on 2026-09-28, `chrome-devtools-axi resize 390 844` reported `resized: width: 390 height: 844`, but `eval '({innerWidth,innerHeight})'` returned `1200×2029`, and `screenshot` saved a 1200×2029 PNG. Repeated after selecting the page and navigating to the Session. `emulate --viewport '390x844x1,mobile,touch'` made `innerWidth`, `innerHeight`, and saved PNG dimensions 390×844. The page had `<meta name="viewport" content="width=device-width, initial-scale=1">`, so this was not a missing page viewport tag. Named isolated session `keep-session-header-chips-off-the-breadcrumb-drive` selected page 2. A false resize confirmation risks declaring mobile visual checks against a desktop rendering.

Replay: launch an isolated named session, `open` a local page, `selectpage` the new page if open times out, `resize 390 844`, then compare reported size to `eval '({innerWidth,innerHeight})'` and screenshot dimensions. Workaround: `emulate --viewport '390x844x1,mobile,touch'`; verify actual `innerWidth` before collecting. Whether resize affected another target or failed at the bridge is not established.
