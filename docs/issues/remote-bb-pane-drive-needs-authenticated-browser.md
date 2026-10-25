---
stage: "done"
assignee: "agent:auto-routine"
author: "session:thr_p7a53zfivb"
---
Drives of bb's own UI (a bb plugin pane such as the tracker) kept stopping at bb Connect's sign-in page, "Sign in with the account that owns this server to open it.", because workers drove a session-private Chrome with an empty profile. It stopped implement, drive and review of [[projects/mlegls-pi/issues/bb-tracker-follows-every-link-in-an-issue]] in turn. `$BB_SERVER_URL` answers 401 too, so the local server is no way around it.

The bb desktop browser carries the owner's signed-in session. On 2026-10-25 (@thread:thr_97xxb6d8ii) `bb browser create --host host_w74xscm3fz --instance … --generation … --thread … --url https://mlegls.getbb.app/plugins/tracker/issues/proj_fgz6kudzrk/replay-cases-first-by-default` opened the tracker pane signed in, and `bb browser capture` screenshotted it. `acquire` gives a lease and `connection` a CDP endpoint for clicking (`bb guide browser`); no credentials move. The maintainer: "it's generally ok as long as the underlying thing works, and bb connect can be "trusted" unless i notice it broken". So a drive through the desktop browser counts, and needn't prove Connect itself.

## tasks

1. Say in the [verify-story skill](../../skills/enabled/all/mlegls/lifecycle/verify-story/SKILL.md) and the [drive role](../../agents/roles/drive.md) (wherever browser choice is described) that bb's own UI is driven through `bb browser` on a host with a bb window (`bb browser instances --host <id>`), with the lease released and the tab closed afterwards, and that bb Connect is trusted. Check whether the bundled `browser-automation` plugin (disabled; `bb guide browser`) makes clicking easier than raw CDP, and point at whichever is simpler.
2. Do the check the links ticket couldn't: the tracker plugin runs from the Mac's checkout (`/Users/mlegls/dev/mlegls-pi/bb/tracker`, host `host_w74xscm3fz`). If that checkout is on `main` and clean, fast-forward it to include `2b6d8577` and reload the plugin (`bb plugin reload tracker`); otherwise report its state and stop there. Then, in the desktop browser, open the pane for concept's `replay-cases-first-by-default` and click Mission (a concept), an attachment and `prepare-cases-first.ts` (a repository file); each should open a file preview. Record it as that ticket's first use in [its attachment](../attachments/bb-tracker-follows-every-link-in-an-issue/index.md); a link that doesn't open reopens it.

## Result

done: the review passed and all four stories hold on the final head, `708caeee`. I read the diff against the driver's log and looked at all three screenshots. Each one shows its named preview loaded next to the signed-in Issues pane: `Mission.md`, the attachment's `index.md` ("Cases-first first use") and `prepare-cases-first.ts` with numbered lines. The docs edits (task 1) do what the ticket asks. The verify-story skill and the drive role both now say bb's own UI is driven through the desktop browser. They name both routes (the `browser-automation` plugin, and plain `bb browser` with CDP), cover releasing the lease and closing the tab, and say bb Connect is trusted.

I made one change, to docs only. The tracker ticket's attachment index listed the second driver's replay above the first-use record it repeats, so I put the first use first. I also added my review to the end of the driver's log. Nothing in the product changed, so no re-drive or tests were needed.

```yaml
commit: 708caeee
stories:
  - story: Desktop browser reaches tracker using the owner's existing session
    outcome: held
  - story: Mission opens a concept file preview
    outcome: held
  - story: Attachment opens a readable file preview
    outcome: held
  - story: prepare-cases-first.ts opens a repository file preview
    outcome: held
evidence:
  path: docs/attachments/remote-bb-pane-drive-needs-authenticated-browser/drive-2.md
  visual: true
  shots:
    - docs/attachments/remote-bb-pane-drive-needs-authenticated-browser/drive-2-mission.webp
    - docs/attachments/remote-bb-pane-drive-needs-authenticated-browser/drive-2-attachment.webp
    - docs/attachments/remote-bb-pane-drive-needs-authenticated-browser/drive-2-source.webp
tests: []
filed:
  - docs/issues/bb-browser-automation-ready-before-runtime-download-finishes.md (filed by the implementer; ownership left as recorded)
caveats:
  - "The docs tell drivers to try the browser-automation plugin first and to enable it if needed. Enabling and restoring a plugin changes it for every thread using that bb server. Its runtime download also stalled for several minutes in the first drive, while plain bb browser with CDP worked straight away. Both routes are documented, so the order is a judgment call I left as written."
  - "To restore the three links the check needed, the implementer edited the concept tracker's replay-cases-first-by-default issue body (concept commit 92e52c1cd), which is outside this repo. No behavior changed."
  - "Connect was trusted, not tested; only the three requested links were claimed."
```

Evidence: [docs/attachments/remote-bb-pane-drive-needs-authenticated-browser/drive-2.md](../attachments/remote-bb-pane-drive-needs-authenticated-browser/drive-2.md)
