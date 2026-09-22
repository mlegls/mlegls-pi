# Coordinate clicks

Pass the current window snapshot with pixel coordinates:

```ts
const s = await ui.get_window_state({pid, window_id});
await ui.click({pid, window_id, snapshot_id: s.structuredContent.snapshot_id, x, y});
```

Coordinates are window-local screenshot pixels. Exec validates and consumes the observation, then omits snapshot_id from native pixel addressing. Element-addressed clicks retain their native snapshot. Re-observe before another write, including after a refused or unverifiable action.

## Encounter, 2026-09-22

Drove the changed runtime against Cua 0.28.2 and TextEdit's existing “Untitled 2” probe window (pid 45567, window 83548). Captured with query “Cua direct”, then clicked (200, 300) in background mode with the returned snapshot. The driver posted the CGEvent instead of refusing “snapshot_id requires element_index”; it reported effect unverifiable. Reusing the snapshot was rejected by exec before native dispatch.

The retained response is in `extensions/exec/fixtures/cua-coordinate-click.json`; `extensions/exec/cua-runtime.test.ts` replays this adapter boundary. For a live repeat, discover the current TextEdit pid/window and choose a harmless body coordinate from its screenshot. This verifies dispatch and observation consumption, not visual click effect or the original Obsidian SVG interaction. No foreground retry was made.
