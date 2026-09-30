# First-use drive: waiting child in exception mail

## Setup and predictions (before interaction)

Ticket: [address-the-waiting-child-in-exception-mail](../../issues/address-the-waiting-child-in-exception-mail.md). Local CLI, checkout-owned worktree; synthetic live Pi session, no auth. The handoff promises temporary board/state with wake subscriptions and unsubscribed topics, and `bun ab/main.ts mail <topic> <text...>` as the entry point. No target URL or remote deployment. This packet will not seed the shared user's mail state deliberately.

Predictions from the ticket and CLI help (read before sending):

1. When a supervised worker stops at `needs-input` or `blocked`, the owner receives exception mail containing a specific `mail/<hex>` or `wt/<repo>/<branch>` address. Sending there should wake the waiting worker. **Pending**.
2. Sending `ab mail` to a topic with no live subscriber should give a clear warning or error, not only a success-looking message ID. A live subscribed topic should not warn; an explicitly unsubscribed topic should warn. **Pending**.
3. `ticket/<repo>/<slug>` should route to the worker waiting in each phase, or every phase worker should subscribe to its ticket. The reviewer should get a ticket-topic steer rather than the implementer alone. **Pending**.

These are predictions, not observed outcomes. Expected use: prepare isolated temporary state, send CLI messages to matching and nonmatching topics, and inspect printed output and recipient delivery; for exception mail, trigger a waiting supervised worker through the project's public interface if an authorized setup path is available.

## Encounter — 2026-09-30

Tested product revision `72b8cee` (`bun ab/main.ts mail` in this worktree). No server or remote deployment. Entry point reached the mail CLI; it did not create a waiting supervision job or expose exception notifications. Synthetic Pi ran locally via `pi --mode rpc --no-context-files --no-skills --session-dir <temp>/sessions` with normal extension discovery, no prompt/model request, no authentication. Its startup status was `✉ mail/<hex>  # wt/mlegls-pi/address-the-waiting-child-in-exception-mail-drive`. Both Pi and mail CLI received the same `XDG_DATA_HOME=<temp>/data`, `XDG_STATE_HOME=<temp>/state`, `AB_STATE=<temp>/ab`, `AB_SESSION_STATE=<temp>/session`, with inherited Pi session and WM identity unset. After this correction, `mail --stats` began empty and the board writes were confined to `<temp>/data/pi-board/log.jsonl`. Every synthetic Pi process was terminated and waited on; no listener remains. No screenshots: CLI-only journey.

### Actions and observed states

| Step | Action | Observation |
| --- | --- | --- |
| 1 | Isolate only `AB_STATE` and `AB_SESSION_STATE`; send to `ticket/demo/nonexistent-review-1` | CLI printed a message ID plus `warning: could not confirm a live subscriber ... may not be delivered` (exit 0). `mail --stats` unexpectedly still reported 1147 prior mail posts. This trial wrote one synthetic post to the shared board, not the intended temporary state. |
| 2 | Also change `HOME`; send to `ticket/drive/unsubscribed` | Same uncertain warning; stats included shared prior posts. A second synthetic post went into shared board history. Stopped this approach; did not delete anyone's board data. |
| 3 | Set `XDG_DATA_HOME=<temp>/data` and send to `ticket/drive/unsubscribed` | New isolated store; stdout topic plus message ID, stderr `warning: no live subscribers ... message was recorded but cannot wake a reader`; exit 0. |
| 4 | Start synthetic Pi RPC session in that isolated environment, no inherited worker identity | Startup footer exposed `mail/8c2bada6` and `wt/mlegls-pi/address-the-waiting-child-in-exception-mail-drive`. Sending `bun ab/main.ts mail wt/mlegls-pi/address-the-waiting-child-in-exception-mail-drive 'isolated first-use message'` printed an ID and **no warning**. Sending to unlisted ticket topic and `mail/12345678` printed IDs with uncertain-subscriber warnings. |
| 5 | Start second Pi RPC session with synthetic reviewer identity (`PI_WM_HANDLE=drive-demo/address-the-waiting-child-in-exception-mail-review-1`) in the same isolated store | Startup footer listed `mail/ef7e0838` and the worktree channel, no ticket channel. Mailing the live exact mailbox had no warning. Mailing either `ticket/mlegls-pi/address-the-waiting-child-in-exception-mail` or `ticket/mlegls-pi/address-the-waiting-child-in-exception-mail-review-1` warned that a live subscriber could not be confirmed. This synthetic process stayed in the drive worktree, not a real reviewer phase branch; this is **not** evidence that a real reviewer misses its ticket channel. |
| 6 | Terminate and wait for second Pi RPC process; mail its former `mail/ef7e0838` | `warning: no live subscribers ... message was recorded but cannot wake a reader`; exit 0. No Pi process left running. |

All messages remained in the isolated temporary board except steps 1–2; message IDs on stdout alone were not treated as proof of delivery. RPC sessions were never advanced into a conversation turn, so this proves live subscription detection rather than turn wake behavior. The temp test state was removed after the observations were recorded.

### Story outcomes and predictions

1. **Exception mail names a usable waiting worker — unobservable.** Prediction 1 remains untested: the handoff's only entry point is `mail`; no owned supervised run, waiting worker, or exception-mail setup was provided. The CLI reached messaging, not the exception notification. A controlled supervised job deliberately reaching `needs-input`/`blocked` is needed to inspect the owner's mail and try its printed address.
2. **`ab mail` warns on a topic without live subscribers — held.** Prediction 2 met for a fresh absent topic, a previously posted topic with no live subscriber, an exact live mailbox/worktree topic and a mailbox after session termination. Warnings accompany exit 0 and a recorded message ID, as the documented warn-or-fail policy allows. The uncertain wording on unlisted ticket topics does not claim definite non-delivery; it also does not silently imply success.
3. **`ticket/` reaches the phase worker waiting for input — unobservable.** Prediction 3 remains untested against actual supervision: no phase worker existed in the isolated store. The synthetic reviewer identity did not create a ticket subscription in this worktree, but it was not a workmux phase worker on the named reviewer branch.

### Frictions

- The handoff promised isolated state without naming `XDG_DATA_HOME`; `AB_STATE` and even a changed `HOME` did not isolate the board. Two harmless synthetic posts landed on the shared board before the empty-stats preflight succeeded. Tracked as [[projects/mlegls-pi/issues/document-board-store-selector-for-mail-drives]].
- `ab mail` still prints a success-like ID and exits 0 on an absent topic, requiring attention to stderr to know it cannot wake anyone. This meets the ticket's warning alternative but is easy to miss in scripts.
- A bare review-like `PI_WM_HANDLE` did not produce a ticket channel on a drive worktree; the footer made the actual address discoverable. A reviewer phase's routing cannot be inferred from this imitation.

### Replayable checks for reviewer

1. In a temporary `XDG_DATA_HOME` with an empty board, invoke `bun ab/main.ts mail ticket/<repo>/absent-review-1 'steer'`. Accept only a visible warning/error stating that no live subscriber is confirmed (or exists), not solely a message ID. Assert which stream and exit code scripts must inspect.
2. Start an idle Pi session with the mail extension in that same store; read its footer's `mail/<hex>` and `wt/<repo>/<branch>`. Mail each. Accept no missing-subscriber warning while it is live. Stop the session and mail its old mailbox. Accept an explicit no-live-subscribers warning; confirm no turn is woken after exit.
3. Start an actual review-phase workmux worker subscribed to the ticket and a distinct implementer; park the reviewer at `needs-input`. Send to the ticket topic and inspect that the waiting reviewer receives the steer on its next turn (and that it is not delivered only to the implementer). Do not equate posting a board message with wake/delivery.
4. In an owned supervised job, deliberately park one child at `blocked` or `needs-input`; inspect the **owner exception mail**. Accept a literal `ab mail mail/<hex> TEXT` or `ab mail wt/<repo>/<branch> TEXT` address for that child; send there, then confirm the child's next turn receives it and the job resumes rather than remaining parked. Repeat across implement/drive/review if the same formatter serves all phases.

Evidence: this CLI record and the temporary store's observed stats/footer/warnings above. No visual state or screenshot applies.

## Review — 2026-09-30

The diff printed a `wt/` command for exception wakes and checked live subscriptions before `ab mail` recorded the post, but `scopes()` only joined a ticket when its issue file matched the worker's branch or handle exactly. A `feature-review-1` worker therefore did **not** join `ticket/<repo>/feature`; mailing that ticket reached the implementer alone. Fixed scope resolution for the supervised `-drive`, `-review`, and `-consolidate` phase suffixes (including numbered repeats), with exact issue names preferred. Ticket mail is now shared across phases; exception mail's worktree address remains the unicast steer.

Replayed the CLI encounter in an isolated `XDG_DATA_HOME`/`XDG_STATE_HOME` with real git phase worktrees named `feature-review-1`, `feature-drive-1`, and `feature-consolidate-1` and an issue `feature.md`: absent topic returned a message ID on stdout, exit 0, and `no live subscribers` on stderr. An older live session without a subscription snapshot gave `could not confirm a live subscriber`; a live snapshot with a non-waking ticket also warned. A waking subscription snapshot for the review branch accepted its mailbox, worktree, **and** issue ticket without a warning; the board log contained the ticket post. Removing that session record made its old mailbox warn. The regression lives in `lib/board/mail-drive.test.ts` and replays checks 1–3 at the CLI/subscription boundary. `lib/jobs/supervise.test.ts` replays check 4's owner-visible command on an integration exception: `Waiting worker: ab mail wt/main/c TEXT`. The board suite and supervise test passed: 25 tests.

No real workmux review session or supervised waiting turn was launched in this review. The fixture establishes the routing and owner-visible exception text, not that a live Pi worker received and processed a steer or that a supervision job resumed. The first-use outcomes above remain the driver's observations, not retroactive live-delivery claims. No visual evidence applies.

One preliminary CLI probe (`ticket/sample/absent-review-1`) used the shared board before the isolated test setup; its synthetic post was not deleted. All later sends used temporary stores removed by the test. No Pi worker or service was started for this review.

## Second first-use drive — 2026-09-30

[Fresh predictions and CLI replay on reviewed revision `64aa6af`](second-drive.md). The mail warning held in a temporary isolated store; a live drive-phase Pi session accepted its mailbox, worktree, and ticket messages without warning. The handed-off CLI entry point still did not create a supervised waiting child, so owner exception mail, review-phase receipt, and job resumption remain unobservable in this first-use drive.

## Second review — 2026-09-30

Reviewed `49636fe` against both first-use records. One warning defect remained: subscriber detection read live records from `XDG_STATE_HOME` but did not check the record's board store. With an isolated `XDG_DATA_HOME` and a live worker attached to a different board, `ab mail` could report a subscriber who could never receive that post. Live subscription snapshots now include the resolved board directory; the CLI only confirms a match within its own store. Older snapshots with no store remain uncertain rather than promising receipt. A unit replay verifies that session-meta turn-state writes preserve the board/store snapshot. `lib/board/mail-drive.test.ts` now replays the second driver's isolated-store warnings, live review worktree ticket delivery, and exited-reader warning.

For the driver's unobserved review receipt I launched a **real Pi RPC** session in this ticket's `…-review-3` worktree with this worktree's `lib/board/host.ts` and `lib/session-meta/host.ts` loaded explicitly (`--no-extensions -e …`), with an empty temporary `XDG_DATA_HOME`/`XDG_STATE_HOME` and offline mode. The live snapshot named `ticket/mlegls-pi/address-the-waiting-child-in-exception-mail`; `bun ab/main.ts mail ticket/mlegls-pi/address-the-waiting-child-in-exception-mail 'review worker steer probe 2026-09-30'` returned a message ID without warning. The recipient's RPC stream displayed the exact steer and emitted `turn_start`; the board reads log acknowledged that ID under the **review-3 session and cwd**. The automated replay starts a review worktree Pi with the local extensions and asserts the same observable message and turn, not just a posted ID or synthetic subscriber record. All Pi processes were killed and awaited; temporary stores and test worktrees were removed. The initial Pi probe using default extension discovery did **not** load this worktree's revisions (the global package points at the canonical checkout), so it cannot establish this change's behavior; the explicit local extension replay above replaces it. Worktree-version drive setup is tracked in [[projects/mlegls-pi/issues/drive-pi-extensions-from-reviewed-worktree]].

Exception address: the existing `lib/jobs/supervise.test.ts` drives an integration failure through the loop and checks the owner-visible `Waiting worker: ab mail wt/main/c TEXT`; the review phase is also routed to the actual ticket, and a live review session just received a ticket steer. This does not establish an end-to-end supervised parked worker **resuming** after mail (no owned job was started); the address and recipient contracts are exercised separately. The driver observations remain unchanged. The ticket permits warning rather than nonzero status; the separate concern about success-like stdout/exit 0 is [[projects/mlegls-pi/issues/make-undeliverable-mail-status-visible-to-scripts]]. No visual journey applies.

Final affected check: `env -u PI_WM_PARENT_SESSION ab check -- bun test lib/board lib/jobs/supervise.test.ts lib/session-meta` — 33 pass, 0 fail. (`PI_WM_PARENT_SESSION` is inherited from this worker and breaks an unchanged session-meta fixture when retained.)
`ab check -- bunx tsc --noEmit` remains red on unrelated `extensions/memory`, `extensions/obsidian-tracker` and `lib/board/store.test.ts` diagnostics; the mail-drive fixture's own environment typing was fixed in this pass.
