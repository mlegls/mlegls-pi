# First-use drive: oversized worker context

Revision: `43b32ce5064fae607444697e507147cd1c6bddd3`.
Persona: supervisor owner and worker, no authentication. Nonvisual CLI/library journey.

## Predictions before opening the product

From the ticket and setup handoff only:

1. The drive, review and implement role instructions will tell me to save screenshots and accessibility dumps to files, and load an image only when judging it. I expect all three roles to give the same practical guidance.
2. With an isolated worker session below 20 MiB I expect no size warning. After it passes 20 MiB I expect an owner-visible warning naming that session and suggesting steering or redispatch. Continued polling should not repeat the warning.
3. The supplied entry point, `ab check -- bun test ./lib/jobs/supervise.test.ts`, should recreate the advertised synthetic supervisor/worker state and let me see the threshold warning through the public surface. The earlier target was removed; there is no live deployment to reuse. I expect to run authorized preparation in this checkout, without accessing another worker's session or starting real agents.

## Session log

- Checked checkout ownership and clean working tree; HEAD matches the implementer's committed handoff. No deployment selectors, ports, credentials or shared services are needed for the supplied entry point.
- Read verification evidence and computer ownership docs, run-wide coordination decisions, and CLI help. No source, diffs, tests or fixtures inspected.
- Ran the handoff entry point in this checkout and waited for completion. It reported **1 pass, 0 fail, 2 expect() calls**. [Complete output](setup-check.txt) shows existing handoff/integration scenarios and their outbound messages; none is an oversized-session scenario. No threshold, session byte size, or size-warning message appears. This is regression readiness, not the advertised first-use target.
- Opened the three role instructions as the product's user-facing surface. `agents/roles/drive.md:17`, `agents/roles/review.md:8`, and `agents/roles/implement.md:8` all say exactly:

  > Keep screenshots and accessibility dumps in files, not inline in the session; inspect only needed dump excerpts, and load or view an image only when judging it.

- Tried discovery without implementation inspection: `ab supervise --help` documents start/status/resume/adopt/stop but no synthetic-worker seeding route; `docs/dispatch.md` describes launching real workers. `ab lib jobs/supervise` lists only `commitRetrying(1)`, `run(1)`, and `serialized(2)`, without an input schema or a setup recipe. Did not invoke an unknown loop against this run or inflate a real worker's session.
- The handoff says the isolated HOME and synthetic repo were removed, and its threshold probe was ephemeral. There is no committed first-use preparation command for that target in the supplied handoff. The supplied command instead reaches the existing regression harness. The owner warning, its named session, and once-only behavior remain unobservable, not failed.

## Outcomes and expectations

| Claim / prediction | Outcome | Observation |
| --- | --- | --- |
| All three roles teach file-backed captures and judgment-only image loading | held; expectation met | Identical instruction above, read directly from each role. |
| Owner warned once above 20 MiB, naming the session | unobservable; expectation not established | No threshold scenario or warning exposed by the supplied entry point. |
| Supplied entry point recreates the advertised synthetic state | expectation not met | Existing regressions passed and printed handoff/integration mail, not size-warning mail. |
| Existing regression setup finishes successfully | expectation formed on use, met | Command finished with 1 pass and 0 fail. |

## Frictions

The story's seed cannot be recreated from the handoff: the only command runs existing regressions; the actual size-warning probe was not committed. Recorded this occurrence under the existing tooling owner, [[projects/mlegls-pi/issues/archive/backend-supervisor-test-entry-does-not-expose-handoff-routing]], rather than inventing a new launcher or reading tests to reverse-engineer setup.

## Replayable checks

1. Read `agents/roles/{drive,review,implement}.md` as a worker. Accept if each instructs file-backed screenshots **and** accessibility dumps, bounded dump excerpts, and loading images only for judgment. Observed: all three do.
2. Run `ab check -- bun test ./lib/jobs/supervise.test.ts` from this revision. Accept regression readiness if it completes without failures. Observed: 1 pass, 0 fail. Separately accept first-use setup only if it exposes the size-warning scenario and outbound owner message. Observed: it does not.
3. With a committed isolated synthetic-worker setup (missing prerequisite), prepare matching worker/session metadata and a session file below 20 MiB; poll the running loop and record all owner messages. Grow the same session above 20 MiB and poll again, then poll twice more without changing sessions. Accept: no warning below the threshold; exactly one owner warning above it, containing the session's identity and an actionable steer/redispatch route; no duplicate on subsequent polls. Preserve input sizes and outbound messages in the packet. Not performed: no safe reproducible target supplied.

## Cleanup and limits

No browser/native UI, dev server, container, real worker, or deployment was started. The supplied check completed. No screenshots apply. The role-file wording is observed; propagation into newly dispatched workers and oversized-session loop behavior are not established by this drive.

## Review

Reviewed at `7e1b677`, reading the diff with this log.

- Repair (`agents/roles/drive.md`): the capture sentence had landed between numbered steps 3 and 4 and split the list; it is now part of step 3. `review.md` got a blank line before the next paragraph.
- The unobservable story is now observable: the driver's supplied entry point, `ab check -- bun test ./lib/jobs/supervise.test.ts`, replays it as a scenario (`oversized-session`, printed with its warning text). A real `SessionManager` session carrying the worker's spawn metadata is checked under 20 MiB (no owner message), grown past it with a 21 MiB entry (exactly one owner message, containing the session file name, `ab mail <worker>` and `ab supervise resume <ticket> <slug> redispatch`, and the file recorded in `warnedSessionFiles`), then the loop is restarted on the saved state (still one message). Passes; with the threshold raised the scenario fails at the first warning assertion.
- Design note: a warning whose delivery was interrupted (loop aborted before send completes) is retried after restart by design (`pendingSessionWarnings`), so delivery is at-least-once while the owner is reachable and once per file once delivered.
- Story outcomes: role guidance held; owner warning held (previously unobservable, replayable check 3 above is now automated). Friction filed by the driver is unchanged: the general absence of committed setup recipes.
