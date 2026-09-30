# First-use CLI drive

## Before opening the product

Predictions from the ticket and setup handoff:

- **Definitely unsubscribed:** a send will remain recorded, retain its stderr warning, and either exit nonzero or print structured delivery status. Capturing stdout alone must not imply successful delivery when the exit status is checked.
- **Unknown subscriber state:** “could not confirm” will not be treated as definitely undeliverable; the warning remains without a definite-failure exit status.
- **Live subscriber:** sending will succeed without claiming the reader consumed the message.

Setup to recreate: local CLI, this worktree at `171c11933ec09bdec93b372989009c04c8f9b4ba`, synthetic offline Pi persona, no authentication. The supplied entry point is `bun test lib/board/mail-drive.test.ts`; its isolated board/sample repo/subscription records are described as self-created and self-cleaned. No shared daemon, deployment, or data should be modified. This is a nonvisual journey.

The test is an authorized setup/reproduction command, not independently sufficient first-use CLI evidence. I will not read its source, tests or fixtures.

## Setup contact

The supplied reproduction command completed: 1 pass, 0 fail, 30 assertions. It reached a test runner, not an interactive mailbox or a retained seeded board. To drive independently I use the documented `bun ab/main.ts mail` CLI, temporary `XDG_DATA_HOME`/`XDG_STATE_HOME`/`AB_STATE`/`AB_SESSION_STATE`, and the previous drive's explicit checkout-local Pi extensions. Empty mail stats are required before sending. Pi's own help exposes RPC mode, explicit extensions and isolated configuration/session directories.

Additional predictions from `mail --help`: a message ID means recording, not consumption; mailing a mailbox after its process stops should produce the definite-failure warning and nonzero exit. A live session without the board extension should expose unknown subscription state, not a proven absent subscriber. These predictions are recorded before those encounters.

## Independent CLI encounter

[Captured stdout, stderr, exit statuses and RPC readiness](cli-drive.txt). Commands ran from this worktree using its `ab/main.ts`, not PATH `ab`. Bun version was `1.4.2`.

A fresh temporary directory supplied `XDG_DATA_HOME=$TEMP/data`, `XDG_STATE_HOME=$TEMP/state`, `AB_STATE=$TEMP/ab`, `AB_SESSION_STATE=$TEMP/session`, `PI_CODING_AGENT_DIR=$TEMP/config`, and `PI_OFFLINE=1`. Inherited `PI_WM_*`, `WM_*`, `PI_SESSION_ID`, `PI_SESSION_FILE`, `PI_PARENT_SESSION`, and `PI_CODING_AGENT_SESSION_DIR` were removed. Empty initial `mail --stats` established board isolation before any sends.

For each synthetic recipient, launch:

```sh
pi --mode rpc --no-context-files --no-skills --no-extensions \
  --no-prompt-templates --no-themes --session-dir "$TEMP/sessions" \
  -e "$PWD/lib/session-meta/host.ts"
```

Add `-e "$PWD/lib/board/host.ts"` for the subscribed recipient. Send `{"id":"readiness","type":"get_state"}` through stdin and wait for its successful RPC response before mailing `mail/<last-eight-sessionId>`. The response and process lifetime established readiness; the exact loaded extension paths establish checkout ownership. No source or fixture was inspected, no authentication was supplied, and no shared daemon was restarted.

| Action | Observation | Outcome |
| --- | --- | --- |
| Send to `ticket/first-use/definitely-absent` in the empty store | Exit **1**; stdout still contains a recorded ID; stderr says **no live subscribers**, recorded but cannot wake a reader. Stats then count one ticket post. | held |
| Start an owned Pi with session metadata but no board extension; mail its exact mailbox | Exit **0**; stderr says **could not confirm a live subscriber**, recorded but may not be delivered. | held |
| Start an owned Pi with both local extensions; mail its exact mailbox and this worktree topic | Both exit **0**, IDs on stdout, empty stderr. | held |
| Stop and await the subscribed Pi, then mail its former mailbox | Exit **1**, recorded ID, **no live subscribers** warning. | held |
| Final stats | One ticket post, three mailbox posts, one worktree post: every send remained recorded, including both exit-1 sends. | held |

The contract chooses nonzero status rather than structured stdout. A script must retain/check the command's exit status; an ID string alone is still not a delivery receipt. No observed CLI message claimed consumption.

## Expectations

- Definitely unsubscribed send warns and exposes failure outside stderr: **met**, exit 1 while preserving the post.
- Unknown status is not promoted to definite failure: **met**, exit 0 and the cautious warning.
- Live mailbox/worktree sends succeed without asserting consumption: **met**, exit 0 with no warning and only recorded IDs.
- Stopped mailbox becomes definitely undeliverable: **met**, exit 1 after termination and wait.
- Recording is separate from waking: **met**, stats include every send regardless of exit status.

## Frictions

- The handoff's runnable entry point is a self-cleaning test runner, not first-use setup. It passed but left no product state to drive. Filed as [[projects/mlegls-pi/issues/mail-drive-handoff-names-only-a-test-runner]], under the existing supervision-handoff owner.
- Isolation and checkout-local Pi loading required borrowing prior evidence; mail help does not supply these setup commands. Existing owners: [[projects/mlegls-pi/issues/document-board-store-selector-for-mail-drives]] and [[projects/mlegls-pi/issues/drive-pi-extensions-from-reviewed-worktree]]. Their documented workarounds succeeded here.
- Exit-1 sends still print ordinary IDs. This is allowed by the contract's nonzero alternative, but code that discards status still cannot distinguish success from recording. No additional repair requested.

## Replayable checks

1. In the isolated empty store above, capture stdout, stderr and exit separately for `bun ab/main.ts mail ticket/first-use/definitely-absent 'steer'`. Accept exit 1, a nonempty recorded ID, stderr containing `no live subscribers` and `message was recorded but cannot wake a reader`, and stats showing exactly one ticket post afterward.
2. Start metadata-only Pi using the explicit local extension command, await `get_state`, and mail the exact returned mailbox. Accept exit 0 and `could not confirm a live subscriber` / `may not be delivered` on stderr. Do not interpret uncertainty as definite absence.
3. Start Pi with the local board extension too and await readiness. Mail its exact mailbox and `wt/mlegls-pi/make-undeliverable-mail-status-visible-to-scripts-drive`. Accept exit 0 and empty stderr for each. Stop and await that process, resend to its mailbox, and accept exit 1 with the definite warning. Stats must count all three sends.
4. For a shell script capturing only stdout, use `id=$(bun ab/main.ts mail ticket/first-use/definitely-absent 'steer'); status=$?` in the empty isolated store. Accept a retained recorded ID and nonzero `status`, so the script can branch on failure without parsing stderr. Do not test only whether `id` is nonempty. The independent encounter measured these same two outputs separately through subprocess capture.

## Limits and cleanup

The uncertain-state encounter used a live session without subscription metadata, not an actual daemon restart. It establishes the warning/status distinction through a real live process; the historical restart scenario itself was not recreated. Live CLI success establishes subscriber recognition, not next-turn consumption or a resumed supervised worker. Those are not this ticket's acceptance claims.

All owned Pi processes were terminated and awaited; temporary board/config/session state was removed in a `finally` cleanup. No dev server, browser, remote resource or shared service was started. No rendered journey; `visual: false`, `shots: []`. No product repairs were made.
