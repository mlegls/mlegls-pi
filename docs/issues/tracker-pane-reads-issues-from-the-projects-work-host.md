---
stage: "idea"
assignee: "human"
priority: 3
author: "session:thr_97xxb6d8ii"
---
The bb tracker pane shows the bb server's own checkout of a project, not the one where work happens. [server.ts](../../../bb-plugins/tracker/server.ts) reads, snapshots and watches `p.root`, the project's registered path, on the server's filesystem. With the bb server on the Mac and the concept project registered at `/Users/mlegls/dev/mmon/concept`, the pane showed a copy last synced from the beelink hours earlier, so an independent drive of [[projects/mlegls-pi/issues/bb-tracker-follows-every-link-in-an-issue]] found an old issue body and "restored" it in the Mac's copy (2026-10-25, @thread:thr_97xxb6d8ii).

The maintainer's intent: "move pretty much all work to the beelink. bb and mlegls-pi need syncing to the mac so workflows stay consistent, but concept generally shouldn't." So the pane should read a project's issues from the host its work lives on, whichever host the bb server is on. `projectSchema` already carries `hostId`; reading through that host (the host daemon, as `bb file` does) rather than the server's local disk would make the pane right without any concept checkout on the Mac.

The maintainer plans to move the bb server to the beelink soon, which would make server and work host the same for every current project. Worth doing only if it's still wanted after that.
