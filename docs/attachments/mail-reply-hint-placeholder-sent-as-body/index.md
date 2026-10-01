# First-use CLI drive

Revision: `58e7e8e3955a23f728aee34b14e5e4da00a87c04`.
Driver checkout: `mail-reply-hint-placeholder-sent-as-body-drive`.

## Predictions before opening the product

From the ticket, README and setup handoff only:

1. Sending the exact body `TEXT` through `bun ab/main.ts mail mail/abcd1234 TEXT` should fail clearly, tell me to replace the placeholder, and record no message. **Met**: exit 2, actionable placeholder error, empty board readback.
2. Reading a board message should show a reply address or an incomplete command, not the copyable `ab mail … TEXT` trap. **Met on the live Pi RPC surface**: `reply address: mail/ced26d18`, no complete command. The CLI `--show` inspection did not expose this hint.
3. After the rejection I should be able to send a real message, including a correction longer than one word, and read its complete body back. **Met**: the two-sentence argv message and two-line stdin message were recorded intact. This is a compatibility expectation, not a promise to fix the separate unsupported-flags ticket.

## Setup plan

Local CLI in this checkout; no authentication. Dependencies already present; invoke `bun ab/main.ts` rather than the ambient `ab` to test this revision. The handoff supplies no seed or board selector. The existing user-facing issue `document-board-store-selector-for-mail-drives` documents an isolated `XDG_DATA_HOME` plus state directories and an empty `mail --stats` preflight. I will use that workaround in checkout-owned scratch storage before any sends. No server or browser is needed.

## Actual setup and readiness

The tested target was `bun ab/main.ts` in this driver checkout at the revision above, with dependencies already installed. All product sends used checkout-owned `.wm/mail-drive/{data,state,ab-state,session-state}` selectors. Before the first send, `mail --stats` printed nothing; after both placeholder attempts, `lib board read` returned zero messages. No shared-board synthetic sends, destructive seeding or dev servers.

The supplied entry point reached rejection and board storage, but not the live reply hint. I extended setup through the documented Pi host-extension surface: an owned `pi --mode rpc --offline --no-extensions -e "$PWD/lib/session-meta/host.ts" -e "$PWD/lib/board/host.ts" --no-context-files --no-skills --no-prompt-templates --no-themes --no-tools --session-dir "$PWD/.wm/mail-drive/sessions"`, using the same isolated board/state selectors and an empty scratch `PI_CODING_AGENT_DIR`. Pi received no inherited `PI_*`/`WM_*` identities or API-key/token/secret variables. `get_state` and the mailbox status established the actual owned session and checkout before sending. No model credentials were needed to inspect receipt; its model turn ended with `Unknown provider: unknown` after emitting the board content.

For the final signed send only, the CLI retained this driver's real `PI_SESSION_ID`; the receiving Pi had its own distinct session ID. Both used the isolated board, so the displayed driver reply address was not used to send any reply into the shared board.

## Session log and story outcomes

| Action | Observed result | Evidence |
| --- | --- | --- |
| Discover `mail --help`; preflight empty isolated board | Help documents `TEXT` rejection and address-only hints; no preexisting posts | [CLI log](cli-session.txt), sections 1–3 |
| Exact argv `TEXT`, then exact stdin `TEXT` plus newline | Each exits 2 with `"TEXT" is a placeholder, not a message; provide the reply text`; zero messages after both | [CLI log](cli-session.txt), rejection sections |
| Send two-sentence correction containing `TEXT` within real prose; read it back | Full body retained. Absent synthetic recipient warns and exits 1 **after recording**, as help describes | [CLI log](cli-session.txt), correction sections |
| Inspect correction with `mail --show <id>` | Header/body intact, no reply hint | [CLI log](cli-session.txt), “Show correction as wake lines” |
| Send two-line correction via stdin; read both messages | Both lines retained; final CLI stats: two posts, one topic, one sender | [CLI log](cli-session.txt), final sections |
| Start owned Pi RPC; send unsigned real message | Exit 0, live receipt, no reply address because sender is `ab` without a mailbox | [Unsigned RPC log](rpc-unsigned-session.txt) |
| Try signed self-mail as a shortcut | Send exits 0; cursor advances, no board wake within ten seconds. This did not exercise reply rendering | [Self-mail RPC log](rpc-self-session.txt) |
| Start distinct owned Pi RPC; reject `TEXT`, then send signed real message | Placeholder exits 2; real send exits 0 without warning. Board content ends with `reply address: mail/ced26d18`, also present in `get_messages` | [Signed RPC log](rpc-session.txt), `message_start` and final `get_messages` |
| Stop each of the three owned RPC processes | SIGTERM sent; each process waited to exit; cleanup recorded | All three RPC logs, last line |

- **Exact placeholder refusal — held.** Observed through argv, stdin and live-recipient sends; no synthetic placeholder was recorded.
- **Address-only reply hint — held.** Observed in the delivered signed board message, not inferred from help or store metadata.
- **Ordinary message compatibility — held.** Full argv and multiline stdin bodies retained; real signed message reached the live recipient.

No rendered UI journey: `visual: false`, `shots: []`. No source, diffs, tests or fixtures were read, and no product repair was made.

## Frictions and expectations formed during use

- The handoff omitted the board selector. I expected safe isolation to be discoverable from setup/help; it was not. The existing workaround issue supplied the missing selectors: [[projects/mlegls-pi/issues/document-board-store-selector-for-mail-drives]]. No shared-board contamination occurred.
- Help's “as wake lines print it” led me to expect `--show` to expose the reply hint. **Not met**: only the header/body appeared. Owner recorded in [[projects/mlegls-pi/issues/ab-mail-show-omits-reply-address]]. Workaround: inspect actual delivered content via Pi RPC.
- I initially expected an unsigned CLI probe to be enough to see a reply address. **Not met**: an `ab` sender has no mailbox. Sending with the driver's actual Pi session identity produced the address.
- I tried self-mail to avoid needing a separate sender identity. **Not met**: it recorded successfully without a wake. Switching to distinct sender/receiver identities reached the intended surface; this is setup friction, not evidence of a broken reply hint.
- An absent recipient returns a message ID plus exit 1 and a warning after recording. This felt surprising at first, but **met** the help's documented recording/delivery distinction. A live recipient returned exit 0 without warnings.

## Replayable checks

1. In a fresh isolated `XDG_DATA_HOME` and state directories, verify an empty board, send exact argv `TEXT` to `mail/abcd1234`, then read that topic. Accept exit 2, a placeholder-specific actionable error, no message ID and zero stored messages. Repeat with stdin `printf 'TEXT\n'`; accept the same result.
2. Start an owned Pi RPC with the explicit checkout host paths above. Send `get_state`, wait for its mailbox status, then send a real message from a **different** Pi session identity using `PI_SESSION_ID=<sender session> bun ab/main.ts mail <receiver mailbox> '<message>'`. Inspect its `message_start` board content and `get_messages`. Accept the full body followed by exactly `reply address: mail/<sender suffix>` and no generated complete `ab mail … TEXT` command. An unsigned sender and self-mail cannot establish this claim.
3. Send `Correction: the check finished; the literal TEXT above was only a placeholder. This is the complete second sentence.` as one argv body, and `Correction from stdin.\nThe entire second line must arrive.\n` through stdin. Read the topic publicly with `bun ab/main.ts lib board read '{"topic":"mail/abcd1234"}'`. Accept complete stored bodies, only the trailing stdin newline removed, and no rejection merely for containing `TEXT` inside ordinary prose. Capture warning/exit independently of storage when the recipient is absent.

## Limits and cleanup

This drive covers exact `TEXT`, not case/whitespace variants beyond a normal stdin newline, arbitrary destination aliases or unsupported flags. No reply was sent back to the driver and no successful model response was required. All three owned Pi RPC processes were terminated and awaited. No browser pages, services, tunnels, containers or external deployments were started; only ignored checkout scratch data remains.

## Review

Read the diff (`ab/main.ts` exact-`TEXT` refusal, `lib/board/host.ts` address-only hint, `ab/help/mail.md`) against the log; every story's claim matches the code. Not re-driven: no behavior changed.

- Retained check 1 (argv `TEXT` refused, nothing recorded; `TEXT` inside prose accepted) as a scenario in `lib/board/mail-drive.test.ts`, the existing mail CLI replay. Passes.
- Left as evidence: check 2 (live RPC hint text, needs two Pi sessions and only confirms this copy) and check 3 (multiline stdin integrity; unchanged code path).
- Same trap remains outside this ticket's diff: `lib/jobs/supervise.ts` still prints `ab mail <address> TEXT` in waiting-worker and large-session notices (asserted in `lib/jobs/supervise.test.ts`). The CLI refusal now covers them; rewording is a copy choice for the author.
