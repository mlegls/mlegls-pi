---
stage: "idea"
assignee: "agent"
author: "session:01a15e41-4711-73d2-b468-920ae9dd80e6"
priority: 3
---
The full Concept screens canvas doesn't build (2026-10-21): `bun ~/.pi/agent/skills/artboard/scripts/canvas.ts ../../docs/design/screens.json --out ../../.lavish/screens` from `~/dev/mmon/concept/packages/web` aborts with `No element matches .catalog-story-panel`, without naming the frame, on every run against a warm Storybook.

Cause: the artboard captures every frame at once and waits a fixed 1.5s after `#storybook-root > *` appears (`canvas.ts` `capture`). With the canvas's ~80 frames loading together, 16 `.catalog-story-panel` frames hadn't rendered their panel by then; each renders it when loaded alone. Waiting for `frame.selector` (with a timeout that names the frame), or capping concurrency, would fix it.

Transferred from concept's `screens-canvas-build-aborts-on-a-catalog-story-panel-frame` (author session:01a15e41-4711-73d2-b468-920ae9dd80e6). Related: the efficiency audit of 2026-10-22 (@thread:thr_nt35tbjva9) recommends the artboard builder check rendered frame geometry and named variants before delivery.
