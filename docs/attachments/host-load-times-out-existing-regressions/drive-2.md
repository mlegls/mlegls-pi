# Independent CLI drive

## Predictions (written before entry)

- As a developer, `mise run test` should complete successfully without short per-test timeout failures.
- Two concurrent invocations with `HEAVY_SLOTS=1` should start their actual Bun suites sequentially, not overlap.
- `mise run test lib/thread` should scope the runner to that directory.
- Without `heavy` on PATH the task should fail clearly, never run Bun unqueued.
- The advertised 20-second default and preservation of larger overrides cannot be established by a passing run alone; this driver will not inspect configuration or tests.

## Setup and readiness

Tested revision: `5d47d40686dfa84b52171883e43dd427077c8c53`.
Local CLI, owned target `/Users/mlegls/dev/mlegls-pi__worktrees/host-load-times-out-existing-regressions-drive-2`, not the implementer's checkout named in the original handoff. Local-shell persona, no credentials or seed. User reported this worktree's `mise run setup` finished. `pwd` confirmed ownership; `command -v mise bun heavy sem` resolved all four before entry. Bun reports v1.4.3. No service or browser required.

## Actions and observations

1. Started two managed processes concurrently, each invoking `HEAVY_SLOTS=1 mise run test`. A Python subprocess wrapper timestamped merged runner output and propagated its exit status; it did not replace the runner or alter test arguments.
2. A's request: Unix seconds `1792041511.757`; Bun banner: `1792041511.998907`; successful process exit: `1792041629.773701`. Result: **223 pass, 2 skip, 0 fail**, 225 tests / 51 files, 12,438 assertions, 117.75 seconds runner duration.
3. B's request: `1792041511.756977`; Bun banner: `1792041629.977051`; successful process exit: `1792041741.383940`. Result: **223 pass, 2 skip, 0 fail**, 225 tests / 51 files, 12,438 assertions, 111.38 seconds runner duration. B emitted its task launch line immediately but no Bun banner or test output until A exited. Banner-to-exit intervals do not overlap; B started 0.203 seconds after A exited. Requests were effectively simultaneous, so this establishes serialization, not arrival-order fairness.
4. Ran `mise run test lib/thread`: **13 pass, 0 fail**, 4 files, 75 assertions, 17.16 seconds. Only thread-directory test files appeared. This scoped command used default slots and overlapped A briefly; it was not one of the two single-slot full-suite invocations. Thus this is not a claim that the host ran only one suite of any kind during the experiment.
5. Removed PATH entries containing an executable `heavy` in a child environment, then invoked mise by absolute path: task exited **1**, reporting `heavy must be on PATH to queue tests`; no Bun banner appeared. The parent environment was unchanged.
6. Read agent-facing `skills/enabled/pi/mlegls-pi/SKILL.md`: it explicitly instructs `mise run test` for the full suite and permits single-file `bun test <file>`. No `AGENTS.md` exists at this checkout root.

## Outcomes and expectations

- Full-suite invocation passes: **held**, prediction met in both runs; no timeout or assertion failures.
- Concurrent full suites with one slot serialize: **held**, prediction met by timestamped runner boundaries.
- Scoped arguments pass through: **held**, prediction met.
- Missing queue tool fails closed: **held**, prediction met.
- Agent-facing guidance: **held** through the documented CLI surface.
- Exact configured default of 20 seconds and unchanged larger per-test overrides: **unobservable** through these passing runs; requires reviewer's configuration/diff inspection, not an inferred behavioral certification.

## Replayable checks

- Start two `HEAVY_SLOTS=1 mise run test` processes at once; timestamp each Bun banner and completion. Accept both successful and the second Bun banner after the first completes. Task launch lines alone are not evidence that Bun started.
- Run `mise run test lib/thread`; accept only that directory's files and exit zero.
- Invoke absolute-path mise with every PATH directory containing `heavy` removed; accept nonzero exit, clear missing-tool message and no Bun banner.
- Consult package instructions as an agent; accept the queued full-suite command and unqueued single-file exception.

## Frictions and limits

No product failure encountered. The task launch line precedes queue admission, so I formed an additional expectation that runner output rather than task output identifies actual admission; met. A help probe displayed generic mise text saying the task accepts no arguments; the real scoped invocation nevertheless succeeded, so it did not impede this journey (no established failure filed).

No artificial memory pressure was introduced or measured. Successful suites establish the requested invocation and queue behavior, not a measured causal explanation for historical host-pressure failures. No source, test implementation, fixtures or diffs were inspected. All started processes finished; no services or external resources remain. Nonvisual CLI evidence; screenshots: none.
