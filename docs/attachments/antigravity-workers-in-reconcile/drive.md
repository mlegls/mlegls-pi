# Independent CLI drive

## Predictions before first use

- Starting the tracer will seed a disposable `hello-tracer` project. Reconcile will dispatch implement on `acp-antigravity/gemini-4-neon:high`, consume its `done` YAML handoff, dispatch drive and review, and land a greeting of `Hello, visitor!`.
- The implement worker will use the tracker CLI to read the ticket, follow its role, and report both the `AGENTS.md` instruction and the project skill marker. I expect evidence of a skill read, with no manual `AGENTS.md` read needed.
- The run will leave the source checkout's routing unchanged.

## Encounter

Tested `220be52c` with BB 0.50.1, supervision `25e77ab`, and the host's signed-in agy 1.5.13. Started a fresh worktree-owned `.wm/agy-bb` on loopback ports 47741/47742. BB status matched that data directory. The daemon was initially disconnected and connected during setup; the documented recipe then installed the companion and configured Antigravity. Ran the [tracer entry point](index.md#first-use) with a fresh `.wm/agy-tracer-new` record directory. Its readiness checks passed before it seeded the disposable Git project. The greeting persona was anonymous.

- **Chain — met.** The route was `auto-routine`, `acp-antigravity/gemini-4-neon`, `high`; BB identified implement worker `thr_mis7tj69ug` on `acp-antigravity`. It changed the greeting, ran it, committed `473f2b7`, and returned `done` with a fenced YAML handoff. The reconciler advanced without intervention to Pi drive (`thr_ds3gj4pxh2`) and review (`thr_z6i3csvr5t`). Review recorded exactly `Hello, visitor!` and one newline, empty stderr, and exit 0. The reconciler landed `d82e51c` in its scratch target, closed `hello-tracer` at `eae342f`, and finished `done` with no exceptions. Setup plus drive took 5m01s.
- **Tracker and instruction uptake — met.** The event for `bun "$TRACKER_CLI" text hello-tracer` showed exit 0 before the edit. Tool events showed a read of `.agents/skills/hello-tracer/SKILL.md`; the report included the skill marker `cobalt-loom` and the workspace marker `maple-orbit`. No manual `AGENTS.md` read was in the event record. This shows the instruction reached the worker and the worker opened the skill in this configuration; it does not isolate which layer advertised the skill.
- **Unchanged routing — met.** No changes to the source checkout routing appeared in `git status`. Stopped the disposable BB; both ports were closed afterwards.

## Frictions and replay checks

No unresolved friction. Before installation, wait for the disposable daemon to be `connected` as the recipe directs; the initial disconnected state cleared during setup.

1. Replay the [setup and entry point](index.md#setup); expect the identified disposable daemon, Antigravity route and implement worker, then drive, review, and a completed landing. Compare `implement-route.json`, `implement-worker.json`, `status.json`, and `landed-log.txt` in the private record. Accept only `done` with no exceptions and a landed greeting of `Hello, visitor!`.
2. Compare `implement-report.json` and `implement-events.json`: expect a successful pre-edit tracker read, a skill file read, both markers, and a `done` YAML report followed by automatic drive dispatch.
3. After exiting the tracer, check `git status --short` for no routing changes; stop the disposable server and confirm its ports are no longer listening.

## Review

The driver observed exact output, but the replay script's command substitution discarded trailing newlines and masked a nonzero exit from `bun hello.ts`. The final landing check now keeps stdout and stderr separately and checks the exit status and bytes from one invocation. Replayed that check against four scratch greetings: exact output passed; an extra newline, stderr output, and exit 2 each failed. `bash -n` passed. Worker dispatch and routing were unchanged; the independent chain recording above still applies.
