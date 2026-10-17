---
name: artboard
description: "Use when the user requests an artboard: frames arranged on a shared canvas for review in Lavish."
argument-hint: "[what to design]"
disable-model-invocation: true
---

<skill_context>
  <skill_dir>/Users/mlegls/dev/mlegls-pi/skills/enabled/all/mlegls/artboard</skill_dir>
  <workspace_dir>/Users/mlegls/dev/mmon/concept</workspace_dir>
</skill_context>

An artboard is a Lavish canvas of frames: pages of frames the user pans, zooms, rearranges and enters, annotating real elements inside them. Design happens here before implementation, so a non-trivial UI change is seen and corrected within the session.

A frame is either:

- **a hand-written HTML file**: one self-contained page per frame, inline CSS/SVG, relative images and linked fonts, drawn at its `viewport`; for designs nothing renders yet;
- **a Storybook story** in the project's own components, with `globals` and an optional `selector` (default `#storybook-root > *`); for anything the code already draws, so the frame cannot drift from the app. Draw a change in the components themselves, or as a frame's `style` while weighing alternatives.

1. Use the agreed direction, fidelity, content, and app or brand sources. Put the artboard in the project's design directory if it keeps one (concept: `docs/design/screens.md`), else under `.lavish/<name>/`.
2. Write the frames and `layout.json` beside them.
3. Build: `bun ~/.pi/agent/skills/artboard/scripts/canvas.ts <dir>/layout.json [--out dir]`, run from a directory whose `node_modules` has `@playwright/test` (or set `ARTBOARD_PLAYWRIGHT` to a `package.json` path there); Storybook must be running for story frames. It writes `canvas.html`, `canvas.css` and `assets/`, in a few seconds.
4. Open `lavish-axi <dir>/canvas.html`, then `lavish-axi poll <dir>/canvas.html` for feedback. Answer an annotation by changing the frame or component and rebuilding; Lavish reloads the canvas. "Save arrangement" arrives as feedback with each frame's position: write them into `layout.json` as `at`.

## Layout

```json
{
  "storybook": "http://127.0.0.1:6006",
  "pages": [
    { "title": "Flows", "notes": ["Decision to make"], "frames": [
      { "name": "Home", "file": "Main.html", "viewport": [1440, 900] },
      { "name": "Card", "file": "Card.html", "viewport": [400, 240], "at": [0, 1020] }
    ] },
    { "title": "Session", "frames": [
      { "name": "Chat — dark", "story": "app-chat--default", "globals": { "theme": "dark" }, "selector": ".panel", "style": ".panel { gap: 24px }" }
    ] }
  ]
}
```

A file frame is `viewport` in size (default 1440×900); a story frame is the size of the element it copies, measured in that viewport. Pages stack down the canvas, each a row of its frames, unless frames have `at`. `storybook` may read a port from the environment or the nearest `.env`, as `http://127.0.0.1:${STORYBOOK_PORT}`.

Each frame is copied as static DOM: scripts don't run, while scroll offsets, field values and viewport units are frozen as they were drawn, and each frame's CSS is scoped to it (`:root`/`html` become the frame, `body` its body wrapper). So a frame shows a state; show each state worth seeing as its own frame.

Useful sizes: phone 390×844, desktop 1440×900. At 96 px/in: A4 794×1123, Letter 816×1056, Tabloid 1056×1632, A5 559×794. A trifold's outer face runs inside flap, back cover, front cover from left to right; its inner face is one spread. Print layout answers to reading distance and folding, not web-page conventions.

## In Lavish

Lavish runs the canvas in a sandbox without its origin: storage throws (the canvas keeps arrangements in memory) and links annotate rather than navigate. Controls the user operates rather than annotates carry `data-lavish-action`. Clicking inside a frame annotates that element; scroll pans, pinch or ⌘-scroll zooms, dragging empty canvas pans, dragging a caption or page title moves it, double-clicking a caption enters the frame at 100% (Esc leaves), the caption's ↗ opens the frame alone in a new tab (the build writes each as `frame-<page>--<frame>.html` beside `canvas.html`), and the left rail jumps to pages and frames.
