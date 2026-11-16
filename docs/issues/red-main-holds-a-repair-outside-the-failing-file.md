---
stage: "ticket"
assignee: "agent"
author: "session:thr_ihbpyrp6s2"
priority: 2
---
`heldByRed` in `lib/reconcile/checks.ts` lets a landing through red main only if it changes a file the red diagnostics name. A repair whose cause is in some other file is held behind the red it fixes. In concept on 2026-11-15, red main at `9cc25e70c` named `test/browser/shell-tips.spec.ts:52`. The ticket created to repair it (`shell-tips-later-stops-folding-the-hub-tip`) changed only `packages/web/src/ui/workspace/token.ts`, a timer overflow the spec exposed. Its review had already passed the spec twice without retries, and the reconciler still held it with "main is red". The supervisor had to merge it into main by hand (`bd3eb4d23`).

The heuristic works when the repair edits the file that fails. A landing could also be admitted when its issue names the red commit or log (`.git/verify-main/log/<sha>`), or when the owner marks the node as the red repair (for example through `reconcile_constrain` or a resolve action), so the supervisor doesn't have to bypass integration.

Main stayed red 74 minutes (11-15 07:55 → 09:09, 4 red verify runs) while the repair waited. Promoted to a ticket by the 2026-11-16 efficiency audit (@thread:thr_js85m2wmby); the maintainer approved.

## tasks

1. `heldByRed` also admits a landing whose issue names the red commit (its SHA or its `.git/verify-main/log/<sha>`) in its body or handoff, and one the owner marks as the red repair through `reconcile_resolve` (an action such as `red-repair`) on a node held for red.
2. Admitted landings still run pre-integrate; the next verify verdict decides whether main is green.
3. Done when: tests show a landing touching another file is admitted when its issue names the red SHA, and when the owner marks it, and is still held otherwise.
