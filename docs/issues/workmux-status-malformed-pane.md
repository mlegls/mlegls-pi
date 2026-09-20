---
next: simplify
---

2026-09-20: while checking the dispatch workmux backend, plain `workmux status --json` on this host failed with `tmux returned malformed pane information` (the returned pane row had a title containing underscores). The failure happens before any dispatch launch. `lib/wm.ts` currently treats status errors as an empty status list, so idle/exit observation cannot be trusted in this environment. Board reports remain a separate path.

Reproduce with `workmux status --json`; repair or update workmux's pane parser, then drive a live dispatch/report/cleanup cycle. No live workers were started during this verification.
