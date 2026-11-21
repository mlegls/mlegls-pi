**First use for [the outreach vault](../../guide/outreach.md).** See the [independent drive](drive.md) for predictions, observations, and replay checks. Local disposable Git main checkout; no accounts or credentials. The fixture starts a loopback Beeper API for each sync and closes it after the CLI exits.

From the mlegls-pi checkout:

```sh
fixture="$PWD/docs/attachments/outreach-vault-format-and-daily-sync/fixture.ts"
outreach="$PWD/skills/enabled/all/mlegls/conventions/outreach/scripts/outreach.ts"
demo=$(bun "$fixture" seed)   # or: seed /path/to/empty/server-host-directory
(cd "$demo"; bun "$outreach" check; bun "$outreach" snapshot --json)
bun "$fixture" sync "$demo" --dry-run
bun "$fixture" sync "$demo"
(cd "$demo"; bun "$outreach" snapshot --json)
bun "$fixture" sync "$demo"
bun "$fixture" reply "$demo"
bun "$fixture" sync "$demo"
bun "$fixture" offline "$demo"
(cd "$demo"; bun "$outreach" snapshot --json)
```

For the combined BB trial, use `$demo` as the project source. Open Outreach after the first sync; run `reply` and the next `sync` after marking Ada handled. Remove the disposable checkout after the trial.

- Seeded: one hypothesis, two candidates, Ada `messaged`, no queued people. Dry run found one reply and left the worktree and sync status untouched.
- First sync pinned `demo-chat`, appended `demo-reply-1` once, and projected Ada as `replied` with last reply `2026-11-20`. Re-sync left Ada's Markdown bytes and queue hash unchanged. Injecting `demo-reply-2` changed last reply to `2026-11-21` and changed the hash.
- Offline sync exited zero, retained the previous successful timestamp, and exposed `beeper: offline (Desktop API unreachable)`. A snapshot invoked from a linked worktree still read the updated main-checkout record.
- A separate disposable run with a Composio CLI stub imported one outbound email, one inbound email, and one Reddit DM notification while Beeper was offline. Re-sync added no entries. Duplicate email handles made `check` exit nonzero. The installed Composio CLI also returned a successful empty response for a synthetic no-match Gmail query; live message import and scheduling were not exercised.
