---
stage: "idea"
assignee: "human"
author: "session:thr_p7a53zfivb"
---
While implementing [[projects/mlegls-pi/issues/bb-tracker-follows-every-link-in-an-issue]] from an enrolled Linux worker, a separate tracker-link-preview plugin was installed and rebuilt with bb plugin dev on the Mac server host. Its projects and resolveLinks RPCs were reachable through bb plugin rpc call. The session-private MCP Chrome browser opened https://mlegls.getbb.app/plugins/tracker-link-preview/issues/proj_fgz6kudzrk/replay-cases-first-by-default but only reached the bb Connect page: "Sign in with the account that owns this server to open it." The browser has no authenticated account session; it could not reach the pane to click Mission, an attachment and a repository script. No browser cookies, account credentials or access controls were changed. The temporary plugin was stopped and removed. Owner: bb remote supervised verification setup. No workaround was established; an authenticated browser or an approved local server-browser connection is needed for the rendered check.
