docs/attachments/artboard-standalone-frames-skip-captured-scroll/drive.md (8 lines)
# Independent drive

## Predictions before opening product
- Opening the caption’s ↗ link will show the same captured content as the canvas phone frame, with vertical 180px and horizontal 142px scroll restored without touching the frame.
- Reloading the standalone page will preserve that captured starting view.
- A bottom-left overlay panel will occupy the same place relative to the 390×844 frame on both surfaces and not shift over content due to standalone sizing.

Setup prescribed: local static export, this checkout’s `.wm/scroll-artboard`, no auth, committed synthetic captured phone frame. Build and readiness not yet observed in this drive. No source/tests/fixtures read.
## Encounter (2026-11-02)
Tested revision `8cf684df5a792bea815ee1cb64e2f0e1c6f4c64a`. Built with the handoff command from this worktree; exit 0 reported `captured Phone map` and the generated absolute canvas path under this checkout. Opened that file URL only after build success. No server, inherited deployment selector, credentials or seed mutation involved. Chromium viewport 1905×2053, English labels, synthetic seeded frame, not live Concept.

1. Opened `canvas.html#scroll-comparison--phone-map`: visible Captured node near the top-left of the scrolled map; Later node clipped at right. Fit/+/− panel at bottom-left below map. DOM read-only observation: recorded `180,142`; actual scrollTop 180, scrollLeft 142.
2. Clicked caption ↗ (`Open alone in a new tab`): new Phone map tab opened. Same visible node crop and bottom-left controls. Actual scroll remained 180,142 without manual scrolling.
3. Compared frame-relative geometry: both frame surfaces 390×844; scroll region 350×600 at (20,120); Fit button at (34,789), size 30.8125×21. Thus panel does not escape to viewport and placement matches.
4. Reloaded standalone: scroll stayed 180,142 and all measured geometry unchanged.
5. Inspected both screenshots: same Captured node, right-clipped Later node, and bottom-left panel. Closed both owned pages; no service started.

## Outcomes, expectations and replayable checks
- Captured scroll restored on standalone: **held**, first prediction **met**. Replay build, open canvas, click caption ↗ without scrolling; accept identical Captured node crop and scrollTop=180/scrollLeft=142 on both.
- Reload restoration: **held**, second prediction **met**. Reload caption-opened standalone; accept unchanged crop and 180,142 scroll state.
- Overlay placement parity in supplied frame: **held**, third prediction **met**. At a viewport larger than 390×844 compare controls relative to frame edges; accept same bottom-left position, not browser bottom-left. Measured Fit button offset (34,789) on both.
- Frictions: none encountered in the scoped journey.
- Limit: historical Concept React Flow scene was not supplied and was not reproduced. The supplied fixed-position panel demonstrates parity, not the historical scene’s precise cause. Ticket explicitly permits recording what remains; no residual difference in supplied surface.

## Visual evidence
- [Canvas at 100%](drive-canvas.webp): captured map view and panel within phone frame.
- [Caption-opened standalone](drive-alone.webp): matching crop and panel position; surrounding layout differs appropriately (canvas centered vs standalone top-aligned).
