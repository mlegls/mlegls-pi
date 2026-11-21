# First-use drive

Tested revision: `646215e1`. Maintainer persona, disposable Git checkout, loopback Beeper; follow the [setup recipe](index.md) and [guide](../../guide/outreach.md).

## Predictions before first use

- A valid vault passes `check`; malformed YAML, missing hypotheses, invalid stages/verdicts and duplicate channel handles are rejected with enough context to find the record.
- Snapshot v1 identifies the main checkout even from a linked worktree. Candidates stay out of the queue; an overdue contacted person gets `due` and a reply gets `replied`.
- Dry-run previews a Beeper reply without writing Markdown or sync status. Applying imports it once, updates Ada, and changes her queue hash. Re-sync preserves the record and hash; a second reply changes the hash again.
- Offline Beeper leaves the last success intact and surfaces a nonfatal note. With both sources selected, Gmail can still import a known address and a Reddit DM notification, without duplicates on replay.
- The guide gives a daily BB script command the installed CLI understands. This disposable setup does not assume live accounts or a production schedule.

## Observed and replay checks

- **Validation — met.** Seed reports one hypothesis and three people. Add `people/bad.md` with a distinct name, `stage: candidate` and known hypothesis; try malformed YAML (`name: [`), `stage: wrong`, `verdict: wrong`, `hypothesis: missing` and a second `channels.x: '@ren-demo'`, separately. Each run exited 1 with the path and reason. The duplicate diagnostic named both records.
- **Snapshot and due queue — met.** Seed returned v1, one hypothesis, two candidates, Ada `messaged`, no queued people and no sync history. `git worktree add --detach` and snapshot from the linked worktree still showed the main root and its last sync. After both replies, set Ada to `messaged` and both `last_contacted` and `next_followup` to the same UTC date as the last reply (not in the future); her reason was `due`, candidates stayed null. Revert those edits.
- **Beeper — met for inbound.** The loopback fixture answered and exited after each run. Dry-run previewed one message; Git stayed clean and `.git/outreach-sync.json` did not exist. Apply appended `demo-reply-1`, pinned `demo-chat`, set Ada `replied` with `lastReply: 2026-11-20`, and left `lastContacted: 2026-11-19`. Replay preserved SHA-256 of the Markdown and the queue hash. `reply` followed by `sync` added exactly one `demo-reply-2`, set `lastReply: 2026-11-21` and changed the queue hash. Outbound import was not driven; the outbound entry was seeded.
- **Offline and Reddit notification — met at the mocked boundary.** `offline` exited 0, kept the exact previous Beeper success timestamp and exposed `beeper: offline (Desktop API unreachable)`. In a separate run on the disposable vault, put a local `composio` shim first in PATH and point Beeper at `http://127.0.0.1:1` with a mock token. Give a `messaged` person `channels.reddit: u/outreach-demo`; return `data.messages` containing a notification with ID `reddit-one`, `internalDate` in epoch milliseconds, and sender `noreply@reddit.com` and subject `u/outreach-demo sent you a message` in `payload.headers`. `sync` imported `gmail:reddit-one` as a Reddit inbound entry, moved the person to `replied` and recorded Gmail success beside the Beeper offline note. Replaying did not add an entry.
- **Direct Gmail — unobserved independently.** The shim saw a `GMAIL_FETCH_EMAILS` participant query for the known address. A synthetic response with Gmail-style From/To headers did not add a direct message. The handoff recipe has no runnable Composio stub or response example, so this drive did not establish whether its synthetic response matched Composio's output. Replay against a captured, sanitized Composio result or the implementer's stub: expect inbound and outbound entries for a known address, updated dates and no duplicate IDs on replay.
- **Automation guide — command flags met.** `bb automation create --help` advertised `--script`, `--cron`, `--timezone`, `--working-directory`, `--timeout` and `--interpreter`; the example uses those flags. No actual scheduled tick or live account was driven. To verify execution, create the schedule against a disposable project, trigger one tick, and look for the new reply and success timestamp in its own vault.

The Beeper recipe reached the CLI with no setup repair. Disposable checkouts and the temporary Composio shim were removed; no services remain.

## Review replay

- **Direct Gmail — held.** The [Composio fixture](mock-bin/composio) supplied one SENT message to Ren and one INBOX message from Ren. The CLI imported both, logged `gmail:sent` and `gmail:received`, moved Ren to `replied` and set `last_contacted: 2026-11-19`, `last_reply: 2026-11-20`. Replay left the file byte-identical. The shim exercises the CLI boundary without mailbox access.
- **Outbound Beeper — held.** The fixture introduced an unseen `demo-outbound-2` after the first import. Sync appended it once and advanced Ada's `last_contacted` to `2026-11-22`. Replay left the file byte-identical.
- **Scheduled sync — held.** BB project `proj_gnixjq48iz` pointed at the seeded main checkout. Using the guide's bash/mise and working-directory settings with a one-minute cron and the loopback fixture command, `arun_fisbcdnc6uq` ran with trigger `schedule`, exit 0, and output `beeper imported 1 message(s) across 1 record(s)`. The project vault held `demo-reply-1`, stage `replied`, and a Beeper success timestamp. Deleted the automation and project after observing the tick.
