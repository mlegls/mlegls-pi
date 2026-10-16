---
stage: idea
author: "session:01a143a2-9f90-7000-989a-a1761d88fbb6"
---

A project-level home for Lavish design canvases: each canvas is a board, boards sit in folders, and one place lists and opens them across projects, so a maintainer browses a project's UI design the way Figma organizes files.

Origin: Common Concept, 2026-10-16. After Paper proved slow to iterate in (rebuilding live CSS as editable layers), the maintainer settled on a Lavish canvas of live Storybook DOM (`concept/packages/web/scripts/screens.ts`, `screens-canvas.ts`, `docs/design/screens.md`): pannable, zoomable pages of screens, captions to drag and double-click into, a page/screen rail, and Lavish annotations on real elements. "This for single sessions + Storybook for persistence covers the whole experience"; the missing piece is organization above one canvas, which is project-generic agent tooling and belongs here.

Open questions:
- Whether the board/folder layer is a Lavish feature (a server index of artifacts) or an mlegls-pi skill plus a small server over each project's boards.
- Whether the canvas runtime (pan/zoom/enter/arrange inside Lavish's sandbox) moves here as a reusable template, with the project keeping only its capture of screens. Lavish's sandbox lacks `allow-same-origin`, so `localStorage` throws and plain links annotate; the concept canvas works around both (in-memory store, `data-lavish-action` controls).
- Where arrangements persist: today "Save arrangement" queues positions for the agent to write into the project's spec.
