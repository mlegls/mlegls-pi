---
stage: idea
assignee: agent
---

2026-09-20: while checking the dispatch workmux backend, plain `workmux status --json` on this host failed with `tmux returned malformed pane information` (the returned pane row had a title containing underscores). The failure happens before any dispatch launch. `lib/wm.ts` currently treats status errors as an empty status list, so idle/exit observation cannot be trusted in this environment. Board reports remain a separate path.

Reproduce with `workmux status --json`; repair or update workmux's pane parser, then drive a live dispatch/report/cleanup cycle. No live workers were started during this verification.

2026-09-22 triage: wm/board are disabled in exec during the Orca trial; they remain an alternative under evaluation. This report does not establish a failure in current Orca dispatch. Establish whether a supported caller still needs workmux before authorizing the parser repair or starting workers.
