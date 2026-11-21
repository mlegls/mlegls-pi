# Why the November 16 tracker updates lost their bodies

The verification worker built both replacement bodies, then passed each string to `child.stdin.end(next)` on a process started with `Bun.spawn(..., { stdin: "pipe" })`. The retained tool call (@thread:thr_h7keb6vppt#msg=729) shows the caller and the process receipt (@thread:thr_h7keb6vppt#msg=736) shows exit 0. Bun's subprocess stdin is a `FileSink`: `.end()` closes it and takes no payload. The tracker received EOF at byte zero. Passing the body as the spawn `stdin` option sends the bytes.

The Common Concept history shows what was published:

| UTC on 2026-11-16 | Commit | Effect |
| --- | --- | --- |
| 16:31:32 | `0d59e46905` | Deleted all 37 body lines of `verify-full-5000-card-profile-opening`. |
| 16:31:39 | `a2ae20e405` | Deleted all 79 body lines of `joined-5000-profile-practice-and-map-stay-loading`. |
| 16:40:03 | `46467165b7` | Restored both bodies and recorded the failed joined verdict. |

Both contracts are readable through global `issues.ts text` from the Common Concept checkout. They now include later accepted verdicts and are at `done`; no historical contract was written over them. For the original failure, publication persisted the empty replacement the caller sent. The existing [blank-body safeguard](../tracker-update-can-wipe-an-issue-body/index.md), implemented in `f20888a76`, refuses that replacement before modifying the issue; this incident needs no second CLI change.

## Try it

From this checkout, run:

```sh
bun docs/attachments/tracker-issues-lose-bodies-after-verification-update/replay.ts
```

The entry point creates a disposable Git-backed vault and seeds `stdin-replay` as a local editor. No service or credentials are needed. It removes the vault on exit. The tested Bun 1.4.5 run showed `Original contract.` after seeding, exit 1 and the same body and HEAD after the historical call, then `Revised contract.` and a new `tracker: update stdin-replay` commit with the corrected caller.
