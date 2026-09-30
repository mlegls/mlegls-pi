# First-use drive: Decision API outage during supervised launch

Tested revision: `276b103` (before this packet). Surface: `ab supervise start <ticket>` and `ab supervise status <ticket>` from the owning checkout. The implementer supplied no running deployment: local CLI workflow, owning Pi session, `JEV_API_KEY` or Cloudflare credentials, ready ticket without seed. Predictions below were written **before invoking the product**, from the ticket and the user-facing `README.md` / `ab supervise --help` only.

## Predictions before first use

1. **Transient 503 or network loss on child launch.** I expect a ready ticket's `ab supervise start` to retry a failed Decision API launch classification with backoff (or skip it if advisory), then advance the child without failing the entire job. I expect `status` to show forward progress or completion, not a dead job. **Met** with synthetic 503: the fresh start advanced to a launched child. At the public `decide` surface, both 503 and network errors recovered after retries.
2. **Persistent 5xx or network loss.** I expect the job to pause rather than end permanently, with one legible “Decision API unavailable” notice, and a subsequent `ab supervise start <ticket>` after recovery to resume. **Partly met:** persistent 503 produced a clear error after four attempts at the decision surface; a persistent 402 left a visible supervisor state and a fresh start resumed. A supervised job held down continuously by 503 was not driven.
3. **402 credits exhausted.** I expect no retries, one “Decision API unavailable” report, and a resumable job when credits return. **Met as far as observed:** one transport attempt, one unavailable state in `status`, a later start continued the same job and launched the child. Actual mailbox delivery count was not inspected.
4. **Advisory residual lint.** If a child reaches a residual lint during a Decision API outage, I expect the lint to say unavailable without blocking its handoff or the supervision job. **Unobservable:** no child ran to handoff under an outage. This ticket describes the lint as already advisory; this drive does not establish its behavior.

## Setup and encounter

The checkout was `mlegls-pi__worktrees/supervise-job-dies-on-a-decision-api-503-at-child-launch-drive` at `276b103` before the prediction commit. The inherited `AB_STATE` was the shared per-user daemon, so I **did not restart or use it for the probe**. I started this checkout's `bun ab/main.ts` with `AB_STATE=$PWD/.wm/daemon-state`, `BUN_OPTIONS=--preload=$PWD/docs/attachments/supervise-job-dies-on-a-decision-api-503-at-child-launch/transport-outage.ts`, a present `JEV_API_KEY` (value never recorded), and a temporary ready `docs/issues/drive-decision-api-outage-probe.md` (`stage: ticket`, `assignee: agent`). Owner: this Pi session. This was a local CLI, not a browser or remote deployment; no seed, no dev server. The preloader replaces only Decision API transport responses before the actual API is reached. Its successful continuation delegates to the live TypeSafe service. Readiness: the isolated daemon accepted `supervise start`, and a normal `decide` call returned a classification. The temporary ticket, worker pane/worktree, and isolated daemon were removed or stopped at the end; the probe's supervisor state remains in this checkout's ignored Git metadata.

### Actions and observations

| Story / action | Observable result | Gap |
| --- | --- | --- |
| Public `decide` call with one synthetic 503 followed by live service | Attempt 1 at ~208 ms was 503; attempt 2 at ~459 ms used the live API and returned `{safe: {choice: "true", ...}}`. | Transport was injected, not a real outage. |
| Public `decide` with two synthetic connection resets followed by live service | Attempts at ~697 and ~948 ms failed; attempt 3 at ~1449 ms succeeded. | The injection simulates `TypeError`, not a real socket reset. |
| Public `decide` with persistent synthetic 503 | Four attempts at ~696, 948, 1449 and 2451 ms; one final CLI error: `Decision API unavailable: HTTP 503 after 4 attempts`. | This is the decision surface, not a persistent supervisor job. |
| Public `decide` with persistent synthetic 402 | One attempt and one final CLI error: `Decision API unavailable: HTTP 402 after one attempt`. | No billing system was modified. |
| `ab supervise start drive-decision-api-outage-probe` with persistent synthetic 402; then `status` | Transport attempt 1 returned 402. Job `supervise-drive-decision-api-outage-probe-munn0y38` reported `completed`, `launched: 0`, and `Decision API unavailable: {"drive-decision-api-outage-probe":"Decision API unavailable: HTTP 402 after one attempt: ..."}`; it did not dispatch a child. | `completed` is a confusing process-state label for a recoverable outage. One state is visible; mailbox cardinality was not verified. |
| Restart isolated daemon with one synthetic 503 then live service; run `supervise start` again | CLI said `running (continuing supervise-drive-decision-api-outage-probe-munn0y38)`. Daemon log showed 503 then real service; `status` advanced to `launched: 1` with a child in `implement`, without an unavailable state in the new run. I stopped the job immediately before the child changed files. | This checks resumption and launch, not child completion. |
| Residual lint outage | Not driven: this probe stopped at launch. | Unobservable. |

The recovery job, its child pane and child worktree, and the isolated daemon were stopped; no deployed data or shared daemon changed. A second attempt to start the *same* probe after deleting its child worktree reported `waiting: unreachable`, as expected for a manually removed retained worker; it did not exercise persistent 503 at job level. The second probe was stopped. No running process or temporary ticket remains.

### Frictions

- Setup supplied a ready ticket but no reproducible outage. To observe the condition I needed an isolated daemon and a transport-injection preloader; a live API success alone cannot establish retry behavior.
- `status` labels a recoverable unavailable run `completed`. The unavailable line gives the useful state, but the headline initially suggested the job was over.
- A stopped supervisor retains its launched child handle. Deleting that worktree and trying another start makes the state `waiting: unreachable`; this was caused by my probe cleanup, not the outage fix.
- The generic `ab` executable points to the canonical checkout, not this worker's code. Driving with `bun ab/main.ts` from this checkout plus a private `AB_STATE` avoided a daemon version mismatch and interference with other users.

### Replayable checks for a reviewer

1. With a test key and this checkout's CLI, preload [`transport-outage.ts`](transport-outage.ts), set `SIM_FAILURES=1 SIM_STATUS=503 SIM_START=$(date +%s000)`, and call `bun ab/main.ts lib decide decide '"A 503 should not fail the supervise job."' '{"safe":{"type":"noul","instructions":"Is the input about supervisor recovery?"}}'`. Accept exactly two intercepted attempts, ~250 ms apart, with a classified result rather than an error. Repeat with `SIM_STATUS=network SIM_FAILURES=2`: accept three attempts and a classified result.
2. Set `SIM_STATUS=503 SIM_FAILURES=20` with the same call. Accept exactly four attempts spaced by increasing delays and one final `Decision API unavailable: HTTP 503 after 4 attempts`. Set status 402 instead: accept exactly one attempt and `Decision API unavailable: HTTP 402 after one attempt`.
3. In an **isolated daemon state** and a fresh temporary ready ticket, set `BUN_OPTIONS=--preload=<absolute path to transport-outage.ts>`, `SIM_STATUS=402 SIM_FAILURES=20`, then run `bun ab/main.ts supervise start <probe>` followed by `bun ab/main.ts supervise status <probe>` with the same `AB_STATE`. Accept no child launched and one unavailable state with HTTP 402. Restart only that isolated daemon, set `SIM_STATUS=503 SIM_FAILURES=1`, run `start` on the **same** ticket, and accept `continuing ...` followed by a child in implement after the 503 and live response. Stop that job and its worker afterwards. Do not use the shared daemon or an actual production ticket.
4. For the still-open advisory question, take a supervised child to residual lint under a persistent injected outage; accept an unavailable advisory lint in its handoff while the child can finish and supervisor still progresses. That state was not set up or observed here.

## Review, 2026-09-30

Reviewed `c218d8c` against the first-use record and the ticket. The `completed` status friction was fixed in `ab/main.ts`: a completed daemon record carrying a Decision API outage now reads `paused (resumable)` in `ab supervise status`, with the HTTP reason still printed. The daemon's historical record remains completed; the CLI label describes the action available to the owner. No earlier first-use observations above were changed.

The replay uses synthetic responses without a live TypeSafe dependency. `bun test lib/decision-outage.test.ts lib/jobs/supervise-outage.test.ts lib/jobs/supervise.test.ts` passed (3 tests, 20 top-level assertions). `lib/decision-outage.test.ts` calls the public `decide` API: one 503 followed by a classification, two connection resets followed by a classification, four attempts for a persistent 503/network error, and one attempt for 402. `lib/jobs/supervise-outage.test.ts` runs the supervisor with a real temporary Git checkout and tracker snapshot, injecting the decision transport, worker dispatch and mailbox: persistent 402 produces one notice and no child, a fresh start with recovery launches `implement`, and persistent 503 produces one notice and no child after four attempts. It invokes the CLI status surface with the saved unavailable record and observes `paused (resumable)` and HTTP 402. Finally, the actual tracker lint CLI is called on completed work under injected 503s; its failure becomes `Residual lint unavailable` in the supervisor's done notification without preventing completion. The earlier `lib/jobs/supervise.test.ts` passed too.

| Claim | Review outcome | Limit |
| --- | --- | --- |
| Transient 503 and network recovery | Held: the driver's live-service continuation remains the first-use evidence; deterministic replay observes a classified answer after the injected failures. | Synthetic transport for replay. |
| Persistent 402 visible and resumable | Held: the driver's isolated daemon resumed the ticket; the replay observes a single notice, paused status and a subsequent launched child. | No billing credits changed. |
| Persistent 503 in a supervise job | Held: the replay observes four transport attempts, one owner notice, saved unavailable state and no child launch. | Worker dispatch/mailbox are fixtures, not a live agent. |
| Advisory residual lint during outage | Held for the supervisor's residual lint: the real tracker lint receives injected 503s, the done notice includes its unavailability and completion proceeds. | A real child handoff during an outage was not produced; its own advisory lint remains outside this supervisor's control. |

The generic `ab` checkout and the shared daemon were not touched. The replay's temporary Git checkout, mocked worker and local HTTP server were removed/stopped by the tests. No external resources were started for this review.
