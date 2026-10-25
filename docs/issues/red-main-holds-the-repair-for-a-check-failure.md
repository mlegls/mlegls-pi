---
stage: "ticket"
assignee: "agent"
priority: 2
author: "session:thr_a35xhciju2"
---
heldByRed (lib/reconcile/checks.ts) only lets a probable repair through red main when red names a failing case as `[project] › <path>:<line>`, the browser-test format. When main goes red in `bun run check` (lint, typecheck), red names the file as `<path>:<line>:<col>: error …`. No landing matches, so the ticket written to fix it is held behind the red it fixes.

Observed 2026-10-25 in concept: main went red on a lint:design error at packages/web/src/ui/materials/quiz/run.tsx:429:47, and the reconciler held every landing into main. The fix ticket main-red-quiz-prompt-class-fails-lint-design changed exactly that file but would have been held too. The supervisor merged it by hand to break the deadlock.

Want: heldByRed also extracts `<path>:<line>:<col>: error` (and tsc's `<path>(<line>,<col>): error`) paths from red and treats a landing touching one as the repair. Test: red text with a lint error on a file; a landing changing that file isn't held, and an unrelated code landing is.
