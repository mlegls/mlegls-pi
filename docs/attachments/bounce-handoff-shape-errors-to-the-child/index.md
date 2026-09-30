# First-use packet: bounce malformed handoffs to child

## Before opening the product — predictions (2026-09-30)

From the ticket and user-facing delivery/verification docs, not from the implementation:

- **Missing/late status sentinel:** When a child finishes with `done` at the end rather than the start, I expect the supervisor to tell that child the status must be the first word, include the verification handoff schema, and allow correction before involving the owner. I expect a second failed correction to escalate to the owner.
- **Malformed structured handoff:** For `stories` containing strings or `evidence` containing a bare path, I expect a field-specific message (ideally naming `stories[0]` or `evidence` and the expected object shape), plus the schema from `docs/verification-evidence.md`, addressed to the same child. I expect the second malformed report to escalate.
- **YAML parse failure:** A handoff that cannot parse (including a list item opening with a quoted phrase) should go to the child once with the parser's message and line and the schema; a repeat should go to the owner.
- **Genuine non-held review outcome:** A valid review handoff containing `failed` or `unobservable` should go directly to the owner rather than asking the reviewer to change a truthful outcome to `held`.

I expect to encounter this as a backend harness with mock worker transport (no account, browser, or deployment), started via `bun test lib/jobs/supervise.test.ts lib/report.test.ts`. The handoff says the target is test-created temporary Git fixtures, with existing supervisor fixture reports, and reports prior readiness as passed. I will verify readiness in this checkout, and use the observable test runner output as the supplied entry point; if it does not expose particular routing or mail contents I will mark those claims unobservable rather than infer them from a green exit.

## Encounter

**Revision:** `d3c60f7895dd421d465df710638090eaa0c4d310` (drive checkout). **Deployment/target:** local backend test harness, no persistent deployment; the supplied target is temporary Git fixtures created and cleaned by the supervisor test in this checkout. **Persona/auth:** mock worker transport, no user authentication. **Seed/state:** supplied existing supervisor fixture reports. No inherited deployment selector was reused and no external data was seeded. **Entry point:** `bun test lib/jobs/supervise.test.ts lib/report.test.ts`.

Ran the entry point in this worktree and waited for exit: Bun 1.4.2, three passes, zero failures, seven assertions across two files in 3.81 s. The runner named `surfaces malformed fenced handoff parse errors`, `recognizes checkpoint as a report status`, and `supervision closes on branches, serializes integration, and retains failed or missing children`. This establishes the provided test harness was runnable; it does **not** expose a mock child's outgoing report, the recipient or contents of corrective mail, the number of retries, or the owner's wake. No browser, server, screenshot or remote target was involved.

| Ticket claim | Action | Observation | Outcome |
| --- | --- | --- | --- |
| Late/missing sentinel bounces to child with schema; second failure escalates | Ran supplied harness | No case name or output reports sentinel routing, message contents or retry count | Unobservable |
| String `stories` / path `evidence` bounce with specific validation and schema | Ran supplied harness | Only generic supervisor pass reported; no diagnostic text or recipient shown | Unobservable |
| Handoff YAML parse error bounces with parser message and line; repeat escalates | Ran supplied harness | Parser test passed, but no supervisor mail, line number, or retry shown | Unobservable |
| Truthfully non-held review escalates immediately | Ran supplied harness | No observed review outcome or recipient | Unobservable |

**Friction:** The only supplied interaction is a passing test run whose three summary lines expose none of the ticket-specific routes or mail. A first-time tester cannot tell whether the new behavior was encountered, and a live `ab supervise` run is not a substitute here: this change has not yet been loaded into the shared daemon, and the handoff gives no owned live subtree to feed malformed reports. The entry point got me to the test runner, not the story's report/mail surface. No product failure is inferred from the green exit. The backend-drive setup gap is tracked in [[projects/mlegls-pi/issues/backend-supervisor-test-entry-does-not-expose-handoff-routing]].

**Expectations after the encounter:** All four predictions above are **not observed**, rather than confirmed or contradicted. I expected at least one surfaced diagnostic/recipient from the backend harness; instead I saw only case names and pass counts. I would expect a corrected child handoff to resume ordinary supervision after the first bounce, but this too is unobserved.

**Replayable checks for a reviewer to encode through the mock-worker transport:**

1. Start an owned, isolated supervisor fixture with a child ready to finish a verification turn. Give the child `done` as its last word, with otherwise valid structured data. Observe the *first* next outbound message: accept only a message to that child naming the first-word sentinel rule and quoting the handoff schema; the owner must not be woken yet. Return a corrected `done`-first handoff and accept ordinary progression without owner wake. Repeat the malformed report twice in a fresh fixture and accept escalation to owner on the second failure, not the first.
2. In separate fresh fixtures, return `done`-first handoffs with `stories: ["a story"]` and with `evidence: docs/attachments/x/index.md`. Accept only child-directed first corrections naming the invalid field/index and expected `{story, outcome}` or `{path, visual, shots}`, respectively, containing the verification schema; second invalid handoffs must wake the owner.
3. In a fresh fixture, return a fenced YAML handoff with a malformed quoted list item and retain the parser's reported line. Accept only a first correction sent to that child containing the parser message **and line** plus schema; after a second parse failure accept owner escalation.
4. In a fresh review fixture, return a syntactically valid handoff containing a story outcome `failed` (repeat with `unobservable`). Accept an immediate owner wake preserving the truthful outcome, with no corrective request to child and no two-failure grace period.

These are requested checks, not observed outputs. Evidence is this command log; `visual: false`, no shots.

## Acceptance review — 2026-09-30

The first-use record above is unchanged. Review used the real `run(JobContext)` supervisor, parser, Git repositories and worktrees with mocked worker report/mail transport. No shared daemon, live agent, browser or deployment was used. Replay: `ab check -- bun test lib/jobs/supervise.test.ts lib/report.test.ts`. The fixture now prints JSON records containing each scenario's outbound recipients and full messages, rather than only a generic pass count.

Tested code revision: `54395b33e4710397899f311c069be0227bdd578c`. Final replay: Bun 1.4.2, three tests passed, zero failed, eight printed routing scenarios, 3.82 seconds. The supervisor's subprocess contains the boundary assertions; Bun's outer count of seven assertions does not include those subprocess assertions. Check execution: `2c743d14-61c4-4d85-a424-293f691aae26`.

The first replay exposed an off-by-one: a second malformed report sent another correction to `root-case-late/case-late`, where check 1 expected the owner `case-late`. Fixed to allow one correction turn, then escalate on the second malformed report. The join continuation also inherited the previous driver's spent correction budget; its first malformed consolidation report woke the owner immediately. A replay reproduced that missing child message; new consolidators now start with their own budget. The schema example now uses real boolean/outcome values (not `true|false` / `held|failed|unobservable` strings) and includes reviewer tests, caveats and the source document reference.

### Current claim outcomes

| Claim / replay | Observed messages and result | Outcome |
| --- | --- | --- |
| Check 1: late sentinel, repeated | First recipient `root-case-late/case-late`: “missing or misplaced status sentinel: put `done` as the first nonblank line (not after the report)”, followed by schema. Second recipient `case-late`: “still invalid after two reports”. | held |
| Check 2: string story | First recipient `root-case-stories/case-stories`: “stories[0] is a string; expected {story, outcome}”, followed by schema. Second recipient `case-stories`: same diagnostic and two-report escalation. | held |
| Check 2: path-only evidence | First recipient `root-case-evidence/case-evidence`: “invalid evidence handoff: evidence is a string; expected {path, visual, shots}”, followed by schema. Second recipient `case-evidence`: same diagnostic and two-report escalation. | held |
| Check 3: malformed quoted YAML item | First recipient `root-case-yaml/case-yaml`: “handoff YAML parse error: Unexpected scalar at node end at line 2, column 21”, including the source line and caret, followed by schema. Second recipient `case-yaml`: parser message and line retained in escalation. | held |
| Check 4: truthful non-held reviews | `failed` and `unobservable` each produce exactly one message, to `case-failed` / `case-unobservable`, preserving the actual outcome. No child correction request. | held |
| Corrected-report expectation | Late sentinel corrected on the second report integrates successfully. The only owner message is normal completion with one child integrated, not an exception. | held |
| New child after corrected join report | Recipients in order: `root-case-join/case-join`, `root-case-join/case-join-consolidate`, `case-join`. A driver's correction does not spend the new consolidator's allowance. | held |

All checks are encoded through report/mail boundaries in `lib/jobs/supervise.test.ts`. Each correction is checked for the schema fields and the prohibition on invented evidence; parsing the supplied example confirms an actual `held` outcome, boolean `visual: false`, and `shots: []`. Existing parser and integration/retention checks remain in the run. No requested check was dropped. The first prediction's “second failed correction” wording conflicts with its later explicit “second malformed report” checks; the ticket's “fails twice” and checks 1–3 determine the boundary.

The driver's setup friction is fixed here for these scenarios by the observable mock-worker replay. The broader backend setup-handoff suggestion remains filed separately at [[projects/mlegls-pi/issues/backend-supervisor-test-entry-does-not-expose-handoff-routing]]. There are no other unresolved expectations or author questions. Temporary fixtures are removed by the test; no external resources remain.

## Rebase acceptance — 2026-09-30

Rebased onto `427003d` at the integration owner's request, retaining main's review-boundary wording and sibling supervisor/parser changes. No production-code conflicts occurred. Tested revision: `8ed82940761483c88101641311166c65dcdd7e57`. `ab check -- bun test lib/report.test.ts lib/jobs` passed all 21 tests across four files in 5.05 seconds (execution `13a709b9-b6fa-436a-aaaf-f15b228043c0`). Nine supervisor routing scenarios printed their mail.

The sibling [[projects/mlegls-pi/issues/turn-end-sentinel-parser-rejects-preambles]] intentionally accepts a standalone trailing `done`. The first combined replay therefore contradicted the old late-sentinel bounce expectation: the child integrated directly. Keep that sibling behavior, not a stricter supervisor-only parser. Check 1 now asserts that a trailing standalone sentinel integrates without corrective mail, and uses an actually missing sentinel to assert child correction followed by second-report owner escalation. The corrected-report replay likewise starts with a missing sentinel and still integrates after correction. These replace the corresponding late-sentinel rows above; all other claim outcomes remain held on the rebased revision. Field-shape diagnostics, parser message/line, truthful non-held escalation and independent consolidator allowance were re-observed unchanged. No shared daemon or external resource was started.
