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
