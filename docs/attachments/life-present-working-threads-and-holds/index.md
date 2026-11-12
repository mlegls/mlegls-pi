# Life presence: implementation first use

Independent acceptance: [first-use drive, predictions and replayable checks](drive.md). All four required library journeys held on `7af0a2297777ea72ff6367b28259c5c815cc4dd7`; nonvisual, with seeded sibling transcript and real read-only bb metadata.

Entry point: [try.ts](try.ts). From the repository root:

```sh
bun docs/attachments/life-present-working-threads-and-holds/try.ts "$BB_THREAD_ID" thr_dfgkcug6jp thr_cgz8k5hbyu
```

This runs the library API against a fresh temporary `PI_BOARD_DIR`, removed on exit. It requires Bun and the existing local bb login. It reads bb metadata only; thread ownership, sessions and the normal records store are unchanged. Arguments are thread ids to associate with the isolated demonstration life `/presence-first-use`. Without arguments it exercises plain-session presence and seeded sibling reading only.

The session file is a seeded pi v3 transcript: a completed assistant response, a new user message, an assistant text with `stopReason: toolUse`, and a partially written final JSON line. The sibling file remains unchanged while the second process reads it. Plain manifestations include the live parent pid, a nonexistent pid, an explicitly ended run, and a detached session.

## Observed first use

Run on 2026-11-12 against the implementation committed with this packet, based on `99f57444a9b9c0e4928df5acc79af84c981996e0`:

- `thr_f3u6m8vfn3` was active: its real title appeared under Working with the seeded run start time.
- `thr_dfgkcug6jp` was idle and unarchived: “mlegls-pi supervisor” appeared under Open with bb's update time.
- `thr_cgz8k5hbyu` was archived: absent from both sections, retained by `threads()` for self recognition.
- The second process saw `plain-working` holding `import schema` (the input had a newline), then cleared it. The parent snapshot immediately omitted the hold.
- The second process read exactly the new user message and unfinished assistant response. The earlier completed run and incomplete JSON suffix were omitted.
- Only the live, unended plain run appeared under Working. Ending it removed it; dead, ended and detached plain sessions stayed absent.
- Detaching the active bb-associated session removed it despite bb still reporting active. `threads()` retained its historical membership.

The bb statuses above are time-dependent. Supply other known active/idle/archived ids when replaying after worker retirement. The transcript and holds are fixtures; titles, statuses and archive state came from real bb metadata in one batched lookup per snapshot.

## API handoff

`present(life)` in `extensions/context/life/present.ts` implements `LifePresence`. `start` persists the supplied run id as the `life.run` record id; `end` names that id. `detach(session)` removes presence and clears its hold; a later `start` reattaches it. `threads()` includes historical threads, while `snapshot()` and `readRun()` use the newest attached session per thread. `readRun()` returns an empty array for an ended or detached run and propagates unreadable-file errors.

Checks: `bun run typecheck` passed. Existing regressions passed: 16 tests across `extensions/context/life/{log,tree,build}.test.ts` and `lib/records/cursor.test.ts`. No acceptance tests were added. This packet is implementation first use; the fresh driver owns acceptance.
