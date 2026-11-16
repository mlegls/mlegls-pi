---
stage: "done"
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

## Result

done

```yaml
commit: 58df60b6
stories:
  - story: Admit cross-file repairs through issue body or handoff red-SHA references
    outcome: held
  - story: Admit cross-file repairs through owner red-repair designation
    outcome: held
  - story: Hold unrelated code without an admission signal
    outcome: held
  - story: Admitted repairs retain normal pre-integrate integration
    outcome: held
evidence:
  path: docs/attachments/red-main-holds-a-repair-outside-the-failing-file/index.md
  visual: false
  shots: []
tests:
  - lib/reconcile/red-repair.test.ts
  - lib/reconcile/checks.test.ts
filed: []
caveats:
  - Admission by issue text means any issue that mentions the red SHA is admitted, including one that only cites it. The ticket asked for this.
  - No live verify-main verdict was observed. Acceptance used disposable fixtures.
  - Each integration scenario in red-repair.test.ts takes about 2 s. All 9 tests run in about 7 s.
  - mise run test:affected is not declared in this project; ran the two test files directly (9 passed, 50 assertions).
```

Evidence: [docs/attachments/red-main-holds-a-repair-outside-the-failing-file/index.md](../attachments/red-main-holds-a-repair-outside-the-failing-file/index.md)
