---
stage: "done"
assignee: "agent"
priority: 2
author: "session:thr_a35xhciju2"
---
heldByRed (lib/reconcile/checks.ts) only lets a probable repair through red main when red names a failing case as `[project] › <path>:<line>`, the browser-test format. When main goes red in `bun run check` (lint, typecheck), red names the file as `<path>:<line>:<col>: error …`. No landing matches, so the ticket written to fix it is held behind the red it fixes.

Observed 2026-10-25 in concept: main went red on a lint:design error at packages/web/src/ui/materials/quiz/run.tsx:429:47, and the reconciler held every landing into main. The fix ticket main-red-quiz-prompt-class-fails-lint-design changed exactly that file but would have been held too. The supervisor merged it by hand to break the deadlock.

Want: heldByRed also extracts `<path>:<line>:<col>: error` (and tsc's `<path>(<line>,<col>): error`) paths from red and treats a landing touching one as the repair. Test: red text with a lint error on a file; a landing changing that file isn't held, and an unrelated code landing is.

## Result

done

I rebased onto `a2f5a38f`. The only conflict was in `lib/reconcile/checks.test.ts`. I kept the new `declaredGates` tests from main and added `heldByRed` to the import. I did not run `test:affected` or the full suite.

`bun test lib/reconcile/checks.test.ts` passes, 5 of 5. The head is now `11c7766a`.

```yaml
commit: 11c7766a
stories:
  - story: Lint diagnostic permits a repair touching the failing file and holds unrelated code.
    outcome: held
  - story: TypeScript diagnostic permits a repair touching the failing file and holds unrelated code.
    outcome: held
  - story: Browser diagnostic retains the existing repair exception.
    outcome: held
evidence:
  path: docs/attachments/red-main-holds-the-repair-for-a-check-failure/index.md
  visual: false
  shots: []
tests:
  - lib/reconcile/checks.test.ts
fixed:
  - the missing acceptance test, commit 11c7766a
filed: []
caveats:
  - Verified at the library surface only, not against a live main-red reconciler.
  - The path pattern is `[\w./-]+`. A colored (ANSI) diagnostic or a path with other characters would not match. This is not demonstrated, so I left it as is.
  - No trade of wall time or cost for isolation, coverage or fidelity. No servers or processes started.
```

Evidence: [docs/attachments/red-main-holds-the-repair-for-a-check-failure/index.md](../attachments/red-main-holds-the-repair-for-a-check-failure/index.md)
