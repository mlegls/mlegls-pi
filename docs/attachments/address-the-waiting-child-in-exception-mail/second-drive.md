# Second first-use drive — 2026-09-30

## Predictions before product contact

From the ticket and README only:

- **Exception mail address.** If a supervised phase worker parks at `needs-input` or `blocked`, I expect the exception mail to name the exact waiting worker address in a command I can send, not just say “Steer it directly.” Sending to that address should wake the worker on its next turn.
- **Mail to an absent subscriber.** A send to a guessed or unsubscribed topic should not look like successful delivery: the CLI should fail or clearly warn that nobody is listening. A subscribed, live worker should accept mail without that warning. If a worker exits or unsubscribes, a subsequent send should warn.
- **Ticket routing.** A send to `ticket/<repo>/<slug>` while a review worker is waiting should reach that review worker rather than only the implementer. If the chosen design subscribes each phase worker to the ticket, the phase-specific address should also work. I expect a reply to resume the loop.

Setup expected from handoff: local CLI in this checkout, synthetic live Pi session without authentication, seeded live/unsubscribed topics in temporary state; entry point `bun ab/main.ts mail <topic> <text...>`. No remote target or credentials. The handoff does not specify a runnable supervised waiting worker, so I may be able to observe send behavior but not exception mail or resumed loop.

## Setup and observed readiness

Tested `64aa6af` from `/Users/mlegls/dev/mlegls-pi__worktrees/address-the-waiting-child-in-exception-mail-drive-2`. The handoff's deployment is local CLI in this checkout; no URL, remote deployment, authentication, or server. For each encounter I made a new temporary board/session store with `XDG_DATA_HOME`, `XDG_STATE_HOME`, `AB_STATE`, `AB_SESSION_STATE`, unset inherited `PI_WM_PARENT_SESSION`/WM identity (except the explicit review-identity probe), and used `PI_OFFLINE=1`. `bun ab/main.ts mail --stats` returned no posts before the first send. An idle `pi --mode rpc --no-context-files --no-skills --session-dir <temp>/sessions` started with normal extension discovery; its footer reported a live `mail/<hex>` and `wt/mlegls-pi/address-the-waiting-child-in-exception-mail-drive-2`. No model request or credentials were used. I waited for the footer and verified that Pi was alive before mailing it. The synthetic Pi processes were terminated and waited on; temporary state removed afterward.

The handoff's entry point reached the mail send surface, **not** a supervised waiting job, its exception notification, or a resumed child. The Pi process was an idle live session in this drive worktree, not a real review worker on a review branch. A second Pi launch with `PI_WM_HANDLE=mlegls-pi/address-the-waiting-child-in-exception-mail-review-1` still reported this worktree's `wt/…-drive-2` footer; the handle alone does not make it a review-branch session.

## Actions and observed states

| Action | Observable result |
| --- | --- |
| Mail an absent `ticket/mlegls-pi/unsubscribed-review-1` in a fresh store, before Pi startup | Exit 0, stdout topic and message ID; stderr: `warning: no live subscribers … message was recorded but cannot wake a reader`. |
| Start idle Pi; send `bun ab/main.ts mail mail/<footer-hex> 'synthetic direct probe'` | Stdout topic and message ID; no warning. |
| Send to `wt/mlegls-pi/address-the-waiting-child-in-exception-mail-drive-2` | Stdout topic and message ID; no warning. |
| Send to `ticket/mlegls-pi/address-the-waiting-child-in-exception-mail` while that drive-2 Pi is alive | Stdout topic and message ID; no warning. Stats counted ticket, mail and worktree posts in the isolated store. This shows that the live drive-2 subscription was recognized; it does not prove review routing or next-turn receipt. |
| Send to an unknown ticket topic while Pi is alive | Exit 0, stdout topic and ID, stderr: `warning: could not confirm a live subscriber … may not be delivered`. |
| Stop and wait for Pi; mail its former `mail/<footer-hex>` | Exit 0, stdout topic and ID, stderr: `warning: no live subscribers … cannot wake a reader`. |
| Launch another idle Pi with synthetic `PI_WM_HANDLE=…-review-1` in this drive-2 checkout; mail the issue's ticket | Footer still names this drive-2 worktree. Ticket mail prints an ID without warning. This does not isolate whether the review handle joined the ticket or the actual drive-2 branch did. |

No rendered UI journey; visual evidence is not applicable. Mail output is not evidence that a child's turn received the content. No shared board posts were made in this pass.

## Outcomes and predictions

- **Exception mail address — unobservable.** Prediction not checked. No supervised worker was parked; the only setup entry point was `mail`, which did not expose owner exception mail or the loop's state. This is a missing setup path for that surface, not a failed address.
- **Warning when no live subscriber — held.** Prediction met for an absent topic in an empty store and for a mailbox after its session exited. A live mailbox, live worktree topic and live ticket topic accepted sends without warning. Unknown topic while a live Pi exists gets a cautious *could not confirm* warning instead of silent success.
- **Ticket mail reaches a waiting phase worker — unobservable.** Prediction partly supported by a live drive-2 ticket-topic send without warning, but a reviewer on a review branch and its next-turn receipt/resumption were not present. The fake review handle did not give us that worker.

## Frictions

- The CLI prints a success-like ID and exits 0 even on definitely unsubscribed topics. The warning is on stderr and easy to miss if an owner or script captures only stdout. This satisfies the ticket's warn-or-fail wording, but it still feels precarious for urgent steers.
- A synthetic review handle in the current worktree looks tempting as a shortcut, but its footer still names the drive branch; it cannot stand in for a genuine review worker. Getting the ticket routing's actual delivery requires an owned review-phase worktree and a waiting child, which the handoff does not supply.
- `mail` alone cannot reproduce an exception: there is no supervised child, owner inbox, or waiting status in the handed-off state. The exact address and wake-after-reply story remain beyond this CLI drive.

## Replayable checks to automate

1. In a fresh isolated store, send to `ticket/mlegls-pi/unsubscribed-review-1`; accept only a nonempty stderr warning of **no live subscribers** (or a nonzero failure), with no success-only result. Capture stdout, stderr and exit separately.
2. Start Pi in that same store, wait for its footer and live process, send to its exact mailbox, worktree topic and issue ticket; accept no absent/uncertain-subscriber warnings. Stop and wait for Pi, resend to the mailbox; accept a **no live subscribers** warning. Confirm isolation with an empty stats preflight and a temporary board log rather than the user's shared store.
3. Start a real `…-review-1` worktree worker with its own footer and a distinct implementer, park the reviewer at `needs-input`, send to the base `ticket/<repo>/<slug>`, then inspect the review worker's next turn for the exact message. Accept review receipt and resumption rather than just a stored post or a warning-free send. Compare against the implementer's turn to rule out implementer-only delivery.
4. In an owned supervised job, park a child at `blocked` or `needs-input`. Inspect the **owner exception mail** for a literal `ab mail wt/<repo>/<waiting-branch> TEXT` or `ab mail mail/<hex> TEXT`; send there and observe the child's next turn receive the message and the loop resume. Repeat across phases if the formatter varies by phase.
