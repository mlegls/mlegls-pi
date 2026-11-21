# Beeper reply to BB Outreach

Combined first use for [managing outreach conversations](../../stories/manage-outreach-conversations.md). The mock serves Beeper's chat and messages endpoints over loopback; the real outreach CLI writes the vault, and the built tracker plugin reads the CLI's snapshot. Tested with mlegls-pi `fe42bb71` and bb-plugins `fb98bae`.

## Independent drive: predictions before opening BB

- Sync an inbound reply into Ada’s Markdown; expect Ada in Queue and the Outreach badge to read 1.
- Mark Ada handled; expect Queue and the badge to clear immediately without editing her record. Sync a second reply; expect Ada and badge 1 to return without reloading.
- Expect Candidates to show Ren before Tess under Salon organizers. Expect Hypotheses to show the decision bar and count Ada’s reply.
- Discuss Ren from Candidates; expect the thread to receive Ren’s evidence and the linked hypothesis’s decision bar.

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

## Independent drive: observed

mlegls-pi `30ed8eb6`, tracker candidate `fb98bae`, signed-in BB Desktop on Mac, 1280 × 720 (English), disposable Git vault on Beelink. The readiness RPC returned Ada as replied with a Beeper sync timestamp; the signed-in route returned HTTP 200. Sync was mocked; the vault, panel, and thread were live.

| Action | Expectation and observation |
| --- | --- |
| Seed and sync once, open Ada from Queue. | Met: one import, Ada in [Queue 1](drive-first.jpg) dated November 20. The rail displayed **2** because another project already contributed one; exact **1** on the rail requires the demo to be the only project with an unhandled item. |
| Click Mark handled. | Met: immediate [Queue 0](drive-handled.jpg), “Queue is clear,” and rail **2 → 1**. Ada remained open in the record drawer. |
| Inject and sync a second reply; leave the same page open. | Met: one import, Ada’s Markdown showed both `demo-reply-1` and `demo-reply-2` as inbound and `last_reply: 2026-11-21`. The first browser snapshot still showed Queue 0; the next showed [Queue 1](drive-resurface.jpg), rail **1 → 2**, and the new reply in the open drawer, without a refresh. |
| Open Hypotheses and Candidates. | Met: [Hypotheses](drive-hypotheses.jpg) showed “Two organizers invite a trial” and **3 people · 1 replied · 0 confirm · 0 kill · 3 open**. [Candidates](drive-candidates.jpg) grouped Ren P1 before Tess P2 under Salon organizers. |
| Select Ren, Discuss, and submit on the Beelink project checkout. | Met: the composer contained Ren and Salon organizers. The [thread](drive-discuss.jpg) showed both mentions; the reply quoted “We publish a reading list after every salon” and “Two organizers invite a trial.” |

### Frictions and replay checks

- The installed tracker changed during the drive and the open route became unavailable. Rebuilding/installing the candidate from a driver-owned checkout and rechecking the RPC and HTTP route restored the surface. [Stable plugin candidate during drive](../../issues/keep-bb-plugin-candidate-stable-during-drive.md) tracks the setup friction.
- Discuss showed “Checkout blocked by uncommitted changes” next to **Current (master)** after sync. It sounded like a submit blocker; submitting on the current checkout worked. Replay after a sync leaves Ada’s record modified: open Discuss on the current project checkout, submit, and expect a thread with both mentions without committing or switching branches first.
- To distinguish a local Queue count from the global badge, leave one unhandled item in another project, then mark Ada handled and sync the second mock reply. Accept Queue **1 → 0 → 1** and rail **2 → 1 → 2** without reload. For the isolated badge assertion, start without the extra project item and expect **1 → no badge → 1**.

The browser session, project and disposable checkout were removed, and the prior tracker deployment and default setting were restored.

## Implementer observations

- The first sync reported one import and touched only Ada's Markdown. It appended `demo-reply-1`, set Ada to `replied`, and the mounted Queue and Outreach rail badge each showed **1**. The footer showed a successful Beeper sync and Gmail had no sync yet.
- Clicking **Mark handled** immediately showed **Queue 0**, “Queue is clear,” and no rail count. The tracker RPC showed Ada's original queue hash stored as handled.
- The second sync imported one message, `demo-reply-2`, and advanced `last_reply` from November 20 to November 21. The tracker RPC exposed a different queue hash and an empty handled map. Queue and the rail both returned to **1** without a refresh. [Resurfaced Queue and both inbound log entries](resurfaced.jpg).
- [Candidates](candidates.jpg) grouped Ren P1 ahead of Tess P2 under Salon organizers. [Hypotheses](hypotheses.jpg) showed **3 people · 1 replied · 0 confirm · 0 kill · 3 open** and the decision bar.
- Selecting Ren and clicking **Discuss** opened a composer with Ren and Salon organizers. The submitted thread showed both mentions; the agent quoted “We publish a reading list after every salon” and “Two organizers invite a trial.” The thread's Outreach panel linked both records. [Discuss handoff](discuss.jpg).

Captures above are from the live BB desktop browser at 1280 × 720 (dark theme, English), cropped to the demo surface. The mock supplied the message content; BB, the Markdown update, and the Discuss thread were live. Live Beeper and Gmail account setup was outside this trial; see the [vault drive](../outreach-vault-format-and-daily-sync/index.md) and [panel drive](../tracker-outreach-panel-for-project-vaults/index.md) for the separate source and UI checks.
