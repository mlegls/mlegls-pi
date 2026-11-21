# Beeper reply to BB Outreach

Combined first use for [managing outreach conversations](../../stories/manage-outreach-conversations.md). The mock serves Beeper's chat and messages endpoints over loopback; the real outreach CLI writes the vault, and the built tracker plugin reads the CLI's snapshot. Tested with mlegls-pi `fe42bb71` and bb-plugins `fb98bae`.

## Start from a disposable vault

On the BB server host, build and install tracker with [its first-use recipe](../../../../bb-plugins/tracker/docs/outreach-first-use.md#outreach-first-use). Skip its standalone fixture. Note the current plugin source and `outreachScript` setting before swapping either. Set `bb_server_host` to the BB host ID of the machine running these commands. From the mlegls-pi checkout, with Bun and the project's dependencies installed:

```sh
fixture="$PWD/docs/attachments/outreach-vault-format-and-daily-sync/fixture.ts"
outreach="$PWD/skills/enabled/all/mlegls/conventions/outreach/scripts/outreach.ts"
demo=$(bun "$fixture" seed)
project_id=$(bb project create --name 'Outreach combined demo' --root "$demo" --machine "$bb_server_host" --json | jq -er '.id')
bb plugin config tracker set outreachScript "$outreach"
bun "$fixture" sync "$demo"
bb plugin rpc call tracker outreach --json | jq -e --arg id "$project_id" '
  .[] | select(.id == $id and .snapshot.lastSync.beeper != null)
  | .snapshot.people[] | select(.slug == "ada" and .queueReason == "replied")
'
printf '/plugins/tracker/outreach/%s\n' "$project_id"
```

Open the printed route on the same BB server in the signed-in maintainer desktop profile. The demo needs no messaging credentials. The readiness RPC above returned Ada and the signed-in route answered HTTP 200. The seed has Salon organizers, two candidates (Ren P1 and Tess P2), and one messaged contact (Ada). The command imports Ada's first reply.

After marking Ada handled, inject and import the second reply with:

```sh
bun "$fixture" reply "$demo"
bun "$fixture" sync "$demo"
```

For Discuss, use the demo project's server-host checkout. Submit a synthetic prompt asking the agent to quote Ren's evidence and the hypothesis decision bar. Close the demo tab, delete the disposable BB project (`bb project delete "$project_id" --yes` also deletes its thread), and remove the seeded checkout. Restore the prior tracker plugin source and `outreachScript` setting (use `bb plugin config tracker unset outreachScript` if it was at the default).

## Observed

- The first sync reported one import and touched only Ada's Markdown. It appended `demo-reply-1`, set Ada to `replied`, and the mounted Queue and Outreach rail badge each showed **1**. The footer showed a successful Beeper sync and Gmail had no sync yet.
- Clicking **Mark handled** immediately showed **Queue 0**, “Queue is clear,” and no rail count. The tracker RPC showed Ada's original queue hash stored as handled.
- The second sync imported one message, `demo-reply-2`, and advanced `last_reply` from November 20 to November 21. The tracker RPC exposed a different queue hash and an empty handled map. Queue and the rail both returned to **1** without a refresh. [Resurfaced Queue and both inbound log entries](resurfaced.jpg).
- [Candidates](candidates.jpg) grouped Ren P1 ahead of Tess P2 under Salon organizers. [Hypotheses](hypotheses.jpg) showed **3 people · 1 replied · 0 confirm · 0 kill · 3 open** and the decision bar.
- Selecting Ren and clicking **Discuss** opened a composer with Ren and Salon organizers. The submitted thread showed both mentions; the agent quoted “We publish a reading list after every salon” and “Two organizers invite a trial.” The thread's Outreach panel linked both records. [Discuss handoff](discuss.jpg).

Captures are from the live BB desktop browser at 1280 × 720 (dark theme, English), cropped to the demo surface. The mock supplied the message content; BB, the Markdown update, and the Discuss thread were live. Live Beeper and Gmail account setup was outside this trial; see the [vault drive](../outreach-vault-format-and-daily-sync/index.md) and [panel drive](../tracker-outreach-panel-for-project-vaults/index.md) for the separate source and UI checks.
