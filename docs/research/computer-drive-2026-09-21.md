# Intent-driven computer use: 2026-09-21

Scope: `lib/computer.ts` via exec’s live `ui` bridge and Jev. No existing product story files cover this new library; the script is `docs/computer.md`. This is a smoke drive, not a reliability estimate.

## Observed

- Calculator: Jev selected and pressed 7. The initial controller stopped because the bridge reported `execution.outcome: unknown`, despite successful AX delivery and a successor observation. Corrected the controller to continue from observed state when a successor exists; transport failures or unknown delivery without observation still stop.
- Continuing from the visible 7, a fresh drive pressed 8, Delete, Multiply, 8, Equals, then declared done. Independently inspected AX static text: expression `7×8`, result `56`. The unnecessary 8/Delete detour demonstrates adaptive recovery, not reliable recorded-sequence adherence.
- A clear-calculation drive with `beforeAction: () => "pause"` returned paused before pressing All Clear.
- TextEdit, isolated file `/tmp/jev-computer-smoke.txt`: fixed input replaced the text with `Intent-driven typing works.`; the next cycle declared done.
- A resolver drive replaced the same document with `Resolver supplied this text.`; independently inspected the AX text area and confirmed the exact value. Two visual observations each retained one image. A final read-only step declared done; JSON serialization preserved its goal and one screenshot block. The first resolver attempt selected needs-input; clarifying that an available resolver can obtain missing text corrected that attempt.
- Normalized exec’s `UIResult.content()` into plain content arrays so serialized events retain screenshot blocks rather than losing private class state.

## Checks and limits

- Full existing suite: 201 pass, 1 skip, 0 fail (202 tests across 32 files).
- TypeScript check: blocked by existing missing `typescript` package in `lib/lint/extract.ts` and its consequent implicit-any errors; no computer-library diagnostic.
- Jev lint against `273b758`: Final run: 30 spans; Event.reason (0.62) flagged as possibly inert. Retained: reason is returned to callers and fed into history. An earlier run also flagged Node.truncated; it is supplied to Jev as evidence completeness.
- `scc-delta.sh` over lib includes installed nested dependencies absent at the starting ref, so its aggregate delta is not an attributable change measurement. Direct scc on the new file: 168 code lines, complexity 102 (baseline file absent).
- Not driven: multi-app workflows, scrolling, cancellation during a native action, external UI races, long-horizon reliability, recorded story replay. No claim that driver done verifies a story.
