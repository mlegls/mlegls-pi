docs/attachments/artboard-standalone-frames-skip-captured-scroll/index.md (38 lines)
# Standalone artboard scroll: implementation first use

Tested code/setup revision: `6d12b32e` (base `8580fd5e`). This is an implementer's first-use comparison, not independent acceptance.

## Setup and replay

Local static export, owned by this ticket's checkout; no running service, deployment selectors, authentication, secrets or remote data. [phone.html](phone.html) is a synthetic 390×844 frame with a map scrolled vertically by 180px and horizontally by 142px, and a fixed-position Fit/+/− panel. [layout.json](layout.json) captures it through the ordinary artboard CLI. These are reproducible setup inputs, not an acceptance test.

From the checkout root, with a package that provides `@playwright/test` and its Chromium installed:

```sh
ARTBOARD_PLAYWRIGHT=/home/mlegls/dev/mmon/concept/packages/web/package.json bun skills/enabled/all/mlegls/artboard/scripts/canvas.ts docs/attachments/artboard-standalone-frames-skip-captured-scroll/layout.json --out .wm/scroll-artboard
```

The package path above is the installed dependency location used for this encounter; on another host set `ARTBOARD_PLAYWRIGHT` to that host's Playwright-enabled `package.json`. The sources and state are all committed here; Concept is used only to resolve the browser dependency, not as a running app.

Build readiness was observed: exit 0, `captured Phone map`, and both generated pages loaded successfully. Open `.wm/scroll-artboard/canvas.html#scroll-comparison--phone-map` directly, then its caption's ↗ link ("Open alone in a new tab"). The link opens `.wm/scroll-artboard/frame-scroll-comparison--phone-map.html`. Both entry points were opened in this checkout. File URLs need no server; the driver rebuilds in its own checkout. All pages opened for this encounter were closed.

## Observations

- After the scroll-only repair, both pages reported `data-scroll="180,142"`, `scrollTop=180` and `scrollLeft=142`. Before matching containment, the canvas surface reported `contain: paint`; the standalone surface reported `contain: none`. In a 1905×2053 browser viewport the panel was 20px from the canvas frame's left/bottom edges, but escaped the standalone frame to the browser viewport (relative left −737.5px, bottom −1189px).
- After also matching `contain: paint`, both surfaces measured 390×844. Both had the captured node at frame-relative `(50,162)` and the panel 20px from the frame's left/bottom edges. Scroll remained `(180,142)` in each. This holds independently of the containing browser's larger viewport.
- Clicking the canvas caption's ↗ opened a new tab titled "Phone map". Its DOM again reported `(180,142)`, `contain: paint`, a 390×844 surface, the same captured node position, and panel offsets `(20,20)`.
- Visual inspection of the final screenshots confirmed the same visible node crop and bottom-left panel, rather than the unscrolled map's "Start" node. Screenshots are Chromium, browser viewport 1100×1100, frame 390×844 at 100%, English, static seeded fixture, not a live app.

| Canvas | Standalone |
| --- | --- |
| [Canvas, entered at 100%](canvas.webp) | [Standalone tab](standalone.webp) |

The historical Concept React Flow zoom-panel encounter is not reproduced here: Concept already applied the workarounds described in the ticket. This experiment establishes and repairs a real containment difference for fixed-position descendants; it does not claim that difference was the historical React Flow panel's cause.

## Checks

- Artboard CLI capture/build of the committed fixture: passed.
- Browser first use via the caption link and frame-relative DOM comparison: passed.
- `bunx tsc --noEmit`: passed.
- `git diff --check`: passed.
- No existing artboard/canvas regression tests were found. No permanent tests were added; independent driving/review follows this handoff.
## Independent drive

Fresh driver at `8cf684df5a792bea815ee1cb64e2f0e1c6f4c64a`: [predictions, setup, encounter and replayable checks](drive.md). Captured vertical/horizontal scroll, reload restoration and supplied fixed-panel placement all held. No scoped friction. [Canvas](drive-canvas.webp) / [standalone](drive-alone.webp), Chromium 1905×2053, seeded synthetic frame. Historical Concept scene was not reproduced.

## Review

Reviewed the scroll/containment diff: it matches the ticket (restore after fonts.ready; standalone surface now has the canvas surface's `contain: paint`). One structural repair: the restore loop was duplicated in canvas.ts and canvas-runtime.js, so it now lives once in `canvas-scroll.js`, which the build prepends to both the canvas and each standalone page. Re-driven after the refactor on the committed fixture: the rebuilt canvas and the standalone page both report `data-scroll=180,142` with scrollTop 180 and scrollLeft 142. The driver's screenshots and geometry are unchanged by this behavior-preserving move. Historical Concept React Flow panel: not reproduced; the `contain: paint` difference is the located cause for fixed-position panels escaping the standalone surface.
