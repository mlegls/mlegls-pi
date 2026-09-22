---
next: measure
---

Extend the native background trial to the actual Electron/custom-control apps.
The TextEdit encounter demonstrates capture and AX replacement while Orca stays
frontmost at the sampled endpoints; it does not establish general background
compatibility. See [guide and recording](../guide/cua-background.md).

Observed costs: Cua 0.28.2's typed actions do not expose element-targeted text or
explicit delivery modes for every operation, so the adapter uses generic tools
for those. Snapshot completeness remained false even with all 38 indexed elements
returned. A successful bold-button press reported an unverifiable effect. Cached
inspection must not imply fresh native validation or absence evidence.

Next measurement should exercise background type/scroll on an Electron app and
sample frontmost app/cursor during delivery, not only before and after. Include an
interrupted mutation: no automatic retry, no later queued write after cancellation.

Origin: native backend replacement, 2026-09-22, run_a99780307abf;
[computer composition](../computer.md), extensions/exec/cua-runtime.ts.
