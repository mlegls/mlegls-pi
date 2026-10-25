---
stage: "idea"
assignee: "agent"
author: "session:01a17065-a748-7495-8ce8-f2c491c4b2d7"
priority: 3
---
A standalone artboard frame (`frame-<key>.html`, the canvas caption's ↗ "Open alone in a new tab") can show different content from the same frame on the canvas: the capture records each scrolled element's position as `data-scroll` ([canvas.ts](../../skills/enabled/all/mlegls/artboard/scripts/canvas.ts), `capture`), and only [canvas-runtime.js](../../skills/enabled/all/mlegls/artboard/scripts/canvas-runtime.js) restores it (`document.fonts.ready` loop over `[data-scroll]`). The standalone page that `canvas.ts` writes into `alone` includes the frame's HTML and `canvas.css` but no script, so a scrolled container opens at the top.

Seen on Concept's screens canvas (2026-10-24, [concept's drawing packet](../../../mmon/concept/docs/attachments/draw-session-map-and-graph-diff-node-marks/index.md#Observations), revision `0e634a47f`): the 390px Session Map frame was captured 142px scrolled; the canvas showed that, its standalone export didn't. In the same encounter the standalone 390×844 graph-diff frame put React Flow's Fit/+/− panel over Node tokens where the canvas crop had it bottom-left; that one's cause wasn't isolated (it may be the same missing runtime, or the standalone surface's `overflow:hidden` sizing). Concept worked around both in `a69fb8ab8` (hid the diff zoom keys, removed the Map frame's scroll container).

Likely fix: give the standalone page the same `[data-scroll]` restore (a few lines, or the relevant part of the runtime), then check whether the zoom-panel placement still differs.

Transferred from concept's `artboard-node-marks-phone-frame-controls-cover-tokens` (author session:01a17065-a748-7495-8ce8-f2c491c4b2d7).