# Attention panel first-use drive

## Predictions before opening

From the ticket and `tracker/docs/attention-first-use.md`: as the maintainer in the existing signed-in bb desktop profile, I expect Attention navigation and a badge, project-grouped Markdown items even for the disposable project without a vault tracker, a selectable recommendation and passage quoting, independent reply drafts and a password input. Sending both prepared replies should collapse answered items, decrease the badge by two, deliver one grouped owner message without the invented credential, and write that credential to the disposable dotenv. Desk removal should remove the items. Newly created desks should appear.

## Target and readiness

Tested plugin revision `caa121dfcda20b5963a86c89991542cb7904bee0`. Live plugin list confirmed enabled/running tracker sourced from `/home/mlegls/dev/bb-plugins__worktrees/attention-panel/tracker`; local entry on port 38886 returned HTTP 200. The owned disposable target from committed setup was project `proj_846b5mt9ew`, root `/home/mlegls/dev/attention-panel-disposable`, owner `thr_m6p2dzhyip`. Browser automation was already enabled and remained enabled. Beelink had no desktop instances; discovery found BB window 1 on `host_w74xscm3fz`. Created an owned desktop automation tab there, using the existing signed-in bb profile through the normal Connect origin. No new server or deployment was started.

## Encounter and outcomes

- **Held: cross-project attention.** Page displayed concept (four items) and attention-panel-disposable (two), with global badge 6. The disposable target has no vault tracker. Other projects' items were left untouched.
- **Held: recommendation, independent drafts and password input.** Clicked Take the recommendation: rollout draft became `Start small and expand after the first use.` Entered an invented value into the demo password input and a separate prose reply into the key item. Send showed `(2)`. The password rendered masked. [Drafts screenshot](01-drafts.jpg).
- **Held: batch send and answered state.** Clicked Send once. Controls temporarily disabled with Sending…, then both disposable items collapsed as Answered, project count became 0, global badge became 4, and Send disabled. Expanded the rollout answered item and saw the sent recommendation. [Answered screenshot](02-answered.jpg).
- **Held: grouped owner message and dotenv destination.** `bb thread log thr_m6p2dzhyip --limit 6` showed one new user message containing both headings, the exact two prose replies, and `Wrote DEMO_API_KEY to /home/mlegls/dev/attention-panel-disposable/.env`. The invented key was absent from that message. The owner subsequently reported both headings and the write notice. Read the disposable dotenv: the requested variable matched the invented submitted value. No real credential was used.
- **Held: quoting.** Reset using the committed recipe from the plugin checkout: `bun scripts/attention-demo.ts /home/mlegls/dev/attention-panel-disposable thr_m6p2dzhyip`. Without reloading, both items returned unanswered. Established a browser text selection over the rollout question using DOM Range, clicked Quote selection, and observed the exact question prefixed with `> ` in that item's reply. This exercises the quote action with native page selection state, not a physical mouse drag.
- **Held: desk removal/recreation watching.** Temporarily renamed only the disposable `desk` directory to `desk-drive6-held`; the project group disappeared on a subsequent snapshot without reload. Renamed it back; subsequent snapshot showed the disposable group again. This covers a desk appearing after absence for an already registered project.

## Expectations and replayable checks

All initial predictions were met for the prepared local target. Reproduce with the committed reset recipe, open Attention in signed-in desktop, choose recommendation, fill both item replies and an invented password, send once. Accept only a 6→4 global badge change (assuming the four unrelated items remain), two collapsed answered records, one grouped message on the owner, and matching disposable dotenv value with no value in the message. Select the question then Quote selection; accept a blockquote in only that draft. Remove/recreate disposable desk while staying on the page; accept disappearance/reappearance without reload.

## Frictions and limits

No unresolved product friction encountered. First desktop-session open exceeded the short CLI timeout; its session was closed, and a managed retry completed in six seconds. The initial full sidebar snapshot was too large; scoped snapshots resolved it. These were recovered setup/inspection observations.

Screenshots are live desktop interactions, English UI, dark theme, bounded to 960×540; the disposable items are committed demo-seeded state. The drafts screenshot shows the secret item and recommendation draft; the answered screenshot shows the expanded rollout record and collapsed key record near the bottom of the viewport.

The complete changed desk-helper→panel journey remains assigned to the parent as specified in the ticket. Remote-only desk refresh, other-dotenv preservation and process-memory lifetime were not audited in this first-use pass. No unit tests or source/diffs were read.

## Cleanup

Restored the disposable desk directory. Reset removed the invented dotenv and left two unanswered items for the parent's combined drive. Closed the owned desktop session/tab; no server started, plugin install altered, or inherited service stopped. Disposable project and live deployment remain parent-owned.

## Review (plugin revision `bb19629`)

Read the plugin diff (`main..caa121d`) against the parent's contract: item format, key hash over project/owner/title/body, answered records dropped on read, secret name/path taken from the parsed file, values absent from drafts, answered record, message and errors, serialized batches, grouped per-owner message. All held; no contract defect found. `tsc --noEmit` passes. `updateDotenv` checked by hand: replaces the first assignment in place and drops duplicates, appends otherwise, picks a quote delimiter that preserves `$`, quotes and backslashes, and refuses a value containing all three delimiters.

Repairs, committed as `bb19629` on branch `attention-panel`:
- Desk recreation: the desk watcher followed the old directory's inode, so removing and recreating `desk/` between two reads left a watcher on the deleted directory (changes were then seen only by the 15 s poll). The root watcher now closes and reopens the desk watcher on a `desk` event.
- Draft loss: the Attention page pruned stored drafts and password inputs for items missing from the response, including those of a project whose read failed. It now skips pruning while any project reports an error.
- Consolidation: `attention.ts` carried a fourth copy of the git-common-dir main-checkout resolution; `tracker.ts` now exports `mainCheckout`, used by `trackerRoot` and the attention service.
- `model.ts`: `ATTENTION_CHANGED` had been inserted under `CHANGED`'s doc comment; each constant has its own again.

Re-drive after rebuild and `bb plugin reload tracker` (same live deployment, source `attention-panel/tracker`): reset the disposable fixture, then `rm -rf desk && mkdir desk` with the file restored; the `attention` RPC returned the disposable project's rollout and key items, and the plugin stayed running. The UI guard is a one-line condition covered by `tsc`; its failure path (project read error) was not exercised in a browser.

Noted, not changed: a failed owner send after a successful dotenv write reports the send error while the file already holds the value, and the cleared password input needs retyping on retry; remote-only projects refresh by 15 s poll, not a watcher; the plugin commits include the SDK migration (`064e30e`, `8585df3`) needed to build.
