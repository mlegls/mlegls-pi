# Independent first-use drive

Tested revision: `7af0a2297777ea72ff6367b28259c5c815cc4dd7`.

## Predictions recorded before opening the product

1. A second process will see a hold set by the first, and clearing it will remove it from the next snapshot. **Met.**
2. Reading a sibling thread will return its unfinished current run including its most recent message, without waiting for end. **Met** with the committed seeded transcript.
3. Real bb metadata will distinguish a working thread from an idle open thread and omit an archived thread, showing titles, since times and holds. **Met.**
4. Plain sessions will show live unended runs as working, excluding dead, ended and detached runs. **Met.**

## Setup and replay

Local Bun library API in this checkout; existing local bb login with read-only metadata access. The prepared entry point owns a fresh temporary PI_BOARD_DIR and seeds an unfinished sibling transcript, holds and lifecycle states. No deployment or resident service is required.

Run from the repository root:

```sh
bun docs/attachments/life-present-working-threads-and-holds/try.ts "$BB_THREAD_ID" thr_dfgkcug6jp thr_cgz8k5hbyu
```

Observed target: `/tmp/life-presence-qKRYjs`. Entry completed successfully (exit 0), parent pid 1783895, second process pid 1783954. The directory was removed on exit. No processes remain from this drive.

## Actions and observations

- Initial parent and second-process snapshots both showed `plain-working` holding `import schema`. Both showed this driver's real bb title under Working, and `mlegls-pi supervisor` (`thr_dfgkcug6jp`) under Open. Working timestamps were `2026-11-12T02:36:36.834Z`; the open thread timestamp was `2026-11-12T02:35:57.560Z`.
- The second process read two sibling messages: user `What are you holding?` and assistant `I am holding the import; this run is unfinished.` with `stopReason: toolUse`. The completed earlier run and incomplete trailing JSON were absent. This demonstrates in-progress file reading using committed seeded data, rather than a live agent writing concurrently.
- After the second process cleared the hold, the parent's next snapshot still showed `plain-working`, without a hold.
- After end, `plain-working` disappeared. Dead, already-ended and detached plain sessions never appeared.
- After detach, this driver's bb thread disappeared despite still running. Open retained the supervisor. Archived `thr_cgz8k5hbyu` appeared in neither section throughout.
- `threads()` retained all three bb ids, including detached and archived history, for self recognition.

## Replayable checks

1. Run the command while its first bb id is running, the second idle/unarchived and third archived. Accept when Working/Open show the first two titles respectively, exclude the third, and include since timestamps. Metadata is time-dependent; substitute known statuses if these threads change.
2. Compare parent-before-probe and second-process snapshots. Accept when both show the same hold, and parent-after-clear omits it while retaining the working session.
3. Inspect `UNFINISHED SIBLING RUN`. Accept when it includes the current user and unfinished assistant messages but excludes prior completed content and partial JSON.
4. Compare after-clear, after-end and after-detach. Accept when plain working disappears only after end, the running bb attachment disappears after detach, and historical ids remain in `threads()`.

## Frictions and limits

No use friction encountered. The supplied entry point reached the requested library surface directly. No rendered UI was involved. The unfinished transcript is seeded and unchanged during reading; concurrent writer behavior beyond that prepared scenario was not exercised. No implementation, tests or fixture source was inspected, and no repository checks were run.
