---
stage: "ticket"
assignee: "agent:auto-routine"
author: "session:thr_p7a53zfivb"
---
---
stage: "ticket"
assignee: "agent:auto-routine"
author: "session:thr_p7a53zfivb"
---
---
stage: "idea"
assignee: "human"
author: "session:thr_p7a53zfivb"
---
While implementing [[projects/mlegls-pi/issues/bb-tracker-follows-every-link-in-an-issue]] from an enrolled Linux worker, a separate tracker-link-preview plugin was installed and rebuilt with bb plugin dev on the Mac server host. Its projects and resolveLinks RPCs were reachable through bb plugin rpc call. The session-private MCP Chrome browser opened https://mlegls.getbb.app/plugins/tracker-link-preview/issues/proj_fgz6kudzrk/replay-cases-first-by-default but only reached the bb Connect page: "Sign in with the account that owns this server to open it." The browser has no authenticated account session; it could not reach the pane to click Mission, an attachment and a repository script. No browser cookies, account credentials or access controls were changed. The temporary plugin was stopped and removed. Owner: bb remote supervised verification setup. No workaround was established; an authenticated browser or an approved local server-browser connection is needed for the rendered check.

Independent drive-2 reproduced the same account gate at the supplied entry URL before any product surface was reachable. No deployment was created, and the opened browser page was closed. Predictions, replayable setup check and a selected gate screenshot: [[projects/mlegls-pi/attachments/bb-tracker-follows-every-link-in-an-issue/drive-2]].

The fix (2026-10-25, @thread:thr_97xxb6d8ii): drive bb's own UI through the bb desktop browser, not a session-private Chrome. `bb browser create --host host_w74xscm3fz --instance … --generation … --thread … --url https://mlegls.getbb.app/plugins/tracker/issues/proj_fgz6kudzrk/replay-cases-first-by-default` opened the tracker pane signed in, past bb Connect, and `bb browser capture` screenshotted it; `acquire` and `connection` give a CDP endpoint for clicking (`bb guide browser`). The desktop browser's profile carries the owner's session, so no credentials move. The local server URL (`$BB_SERVER_URL`) also answers 401, so it's no shortcut.

The maintainer's stance: bb Connect is trusted infrastructure unless it visibly breaks, so a drive that reaches the app through the desktop browser counts; a drive needn't prove Connect itself.

So: the verify-story skill (and the drive role) say that a bb plugin or bb UI is driven through `bb browser` on the host with a bb window (`bb browser instances --host <id>` lists them), releasing the lease and closing the tab afterwards; the bundled `browser-automation` plugin (currently disabled) is the alternative if raw CDP is awkward.
