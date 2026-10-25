---
stage: "ticket"
assignee: "agent:auto-routine"
author: "session:thr_p7a53zfivb"
---
Drives of bb's own UI (a bb plugin pane such as the tracker) kept stopping at bb Connect's sign-in page, "Sign in with the account that owns this server to open it.", because workers drove a session-private Chrome with an empty profile. It stopped implement, drive and review of [[projects/mlegls-pi/issues/bb-tracker-follows-every-link-in-an-issue]] in turn. `$BB_SERVER_URL` answers 401 too, so the local server is no way around it.

The bb desktop browser carries the owner's signed-in session. On 2026-10-25 (@thread:thr_97xxb6d8ii) `bb browser create --host host_w74xscm3fz --instance … --generation … --thread … --url https://mlegls.getbb.app/plugins/tracker/issues/proj_fgz6kudzrk/replay-cases-first-by-default` opened the tracker pane signed in, and `bb browser capture` screenshotted it. `acquire` gives a lease and `connection` a CDP endpoint for clicking (`bb guide browser`); no credentials move. The maintainer: "it's generally ok as long as the underlying thing works, and bb connect can be "trusted" unless i notice it broken". So a drive through the desktop browser counts, and needn't prove Connect itself.

## tasks

1. Say in the [verify-story skill](../../skills/enabled/all/mlegls/lifecycle/verify-story/SKILL.md) and the [drive role](../../agents/roles/drive.md) (wherever browser choice is described) that bb's own UI is driven through `bb browser` on a host with a bb window (`bb browser instances --host <id>`), with the lease released and the tab closed afterwards, and that bb Connect is trusted. Check whether the bundled `browser-automation` plugin (disabled; `bb guide browser`) makes clicking easier than raw CDP, and point at whichever is simpler.
2. Do the check the links ticket couldn't: the tracker plugin runs from the Mac's checkout (`/Users/mlegls/dev/mlegls-pi/bb/tracker`, host `host_w74xscm3fz`). If that checkout is on `main` and clean, fast-forward it to include `2b6d8577` and reload the plugin (`bb plugin reload tracker`); otherwise report its state and stop there. Then, in the desktop browser, open the pane for concept's `replay-cases-first-by-default` and click Mission (a concept), an attachment and `prepare-cases-first.ts` (a repository file); each should open a file preview. Record it as that ticket's first use in [its attachment](../attachments/bb-tracker-follows-every-link-in-an-issue/index.md); a link that doesn't open reopens it.
