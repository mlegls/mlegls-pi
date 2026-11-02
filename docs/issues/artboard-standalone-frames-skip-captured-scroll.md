---
stage: "done"
assignee: "agent"
author: "session:01a17065-a748-7495-8ce8-f2c491c4b2d7"
priority: 3
---
A standalone artboard frame (`frame-<key>.html`, the canvas caption's ↗ "Open alone in a new tab") can show different content from the same frame on the canvas: the capture records each scrolled element's position as `data-scroll` ([canvas.ts](../../skills/enabled/all/mlegls/artboard/scripts/canvas.ts), `capture`), and only [canvas-runtime.js](../../skills/enabled/all/mlegls/artboard/scripts/canvas-runtime.js) restores it (`document.fonts.ready` loop over `[data-scroll]`). The standalone page that `canvas.ts` writes into `alone` includes the frame's HTML and `canvas.css` but no script, so a scrolled container opens at the top.

Seen on Concept's screens canvas (2026-10-24, [concept's drawing packet](../../../mmon/concept/docs/attachments/draw-session-map-and-graph-diff-node-marks/index.md#Observations), revision `0e634a47f`): the 390px Session Map frame was captured 142px scrolled; the canvas showed that, its standalone export didn't. In the same encounter the standalone 390×844 graph-diff frame put React Flow's Fit/+/− panel over Node tokens where the canvas crop had it bottom-left; that one's cause wasn't isolated (it may be the same missing runtime, or the standalone surface's `overflow:hidden` sizing). Concept worked around both in `a69fb8ab8` (hid the diff zoom keys, removed the Map frame's scroll container).

Likely fix: give the standalone page the same `[data-scroll]` restore (a few lines, or the relevant part of the runtime), then check whether the zoom-panel placement still differs.

Transferred from concept's `artboard-node-marks-phone-frame-controls-cover-tokens` (author session:01a17065-a748-7495-8ce8-f2c491c4b2d7).

## shape

In [canvas.ts](../../skills/enabled/all/mlegls/artboard/scripts/canvas.ts), the standalone page pushed into `alone` gets an inline script that restores `[data-scroll]` after `document.fonts.ready`, the same loop as [canvas-runtime.js](../../skills/enabled/all/mlegls/artboard/scripts/canvas-runtime.js) (factor the snippet into one string both use, or inline the few lines). Then rebuild a canvas with a scrolled frame and compare the standalone page with its canvas frame; if a panel's placement still differs (the graph-diff zoom panel case), find whether the standalone surface's `overflow:hidden` sizing differs from the canvas surface and match it, or record what remains in the result.

## Result

done

The standalone frame page now restores captured scroll, and the canvas and standalone pages both open at the captured view (scrollTop 180, scrollLeft 142). I made one structural repair on top of the implementer's fix. The scroll-restore loop was duplicated in `canvas.ts` and `canvas-runtime.js`. It now lives once in `skills/enabled/all/mlegls/artboard/scripts/canvas-scroll.js`. The build prepends that file to the canvas script and to each standalone page, so there's one copy of the loop (commit `0cbd81fc`).

I rebuilt the committed fixture after the refactor and checked scroll in a browser. The canvas and the standalone page each had `data-scroll="180,142"` with the scroll position actually applied. I didn't retake screenshots, since the refactor doesn't change rendering. The only runtime check was this one-fixture rebuild and scroll read-back. I didn't run `test:affected`, and no test covers the artboard build.

Standalone surfaces already got `contain: paint` in `6d12b32e`, which matches the canvas surface. That was the located cause of fixed-position panels escaping the standalone frame. Concept's historical React Flow panel scene wasn't reproduced; the driver's synthetic fixed-position panel showed no remaining placement difference between the two pages.

I appended a review section to the packet's `index.md`. I filed nothing and had no tracker friction to settle.

```yaml
commit: 0cbd81fc
stories:
  - story: Standalone preserves captured vertical and horizontal scroll
    outcome: held
  - story: Reload restores the captured starting view
    outcome: held
  - story: Supplied fixed-position controls match canvas placement
    outcome: held
evidence:
  path: docs/attachments/artboard-standalone-frames-skip-captured-scroll/index.md
  visual: true
  shots:
    - docs/attachments/artboard-standalone-frames-skip-captured-scroll/drive-canvas.webp
    - docs/attachments/artboard-standalone-frames-skip-captured-scroll/drive-alone.webp
    - docs/attachments/artboard-standalone-frames-skip-captured-scroll/canvas.webp
    - docs/attachments/artboard-standalone-frames-skip-captured-scroll/standalone.webp
tests: []
filed: []
changes:
  - "Scroll-restore loop moved from two copies (canvas.ts template string, canvas-runtime.js) into canvas-scroll.js, used by both."
caveats:
  - "Historical Concept React Flow zoom-panel scene not reproduced; parity shown with a synthetic fixed-position panel."
  - "Reload and panel geometry are the driver's measurements, taken before the refactor. After it I re-checked scroll on the committed fixture, canvas and standalone, but not panel geometry or screenshots."
  - "The earlier shots still show the pre-refactor build."
```

Evidence: [docs/attachments/artboard-standalone-frames-skip-captured-scroll/index.md](../attachments/artboard-standalone-frames-skip-captured-scroll/index.md)
