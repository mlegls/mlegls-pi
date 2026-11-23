---
stage: "ticket"
assignee: "agent"
priority: 2
author: "session:thr_vrgtjptnu2"
---
# Visual review only for changes that render something new

A driver's `evidence.visual: true` (`lib/reconcile/checks.ts`) sends a node's review to `visual-reviewer` (Opus 5.5 medium), even when the change renders nothing new and the shots only witness a replay. Of 31 profiled visual reviews 11-08→11-22, 6 were re-record nodes with no UI diff, each ending "replays keylessly… I made no repairs" (e.g. `re-record-the-bounded-lesson-route-without-the-lesson-scope-review-2m`, `-2o`, `re-record-lesson-next-and-cases-first-without-the-lesson-scope-review-2t`, `-2v`, `re-record-lesson-next-and-cases-first-through-their-document-handoffs-review-y`, `re-record-the-bounded-and-timed-lesson-routes-on-the-joined-context-review-1a`). The six visible defects visual review did catch all came with a UI diff. Found by the 2026-11-23 efficiency audit (@thread:thr_vrgtjptnu2); the maintainer asked for this ticket.

## tasks

1. Route review to `visual-reviewer` only when the evidence is visual and the reviewed range touches a rendered surface: files under the project's UI, style, landing, Storybook or official-applet paths, declared per project beside its other reconciler settings (concept: `packages/web/src/**`, `landing/**`, `packages/web/official/**/*.html`, `*.css`). Otherwise the ordinary `reviewer`, which still opens the shots.
2. The join rule at `lib/reconcile/reconcile.ts` (`only = ["tidy", …visual-reviewer]`) uses the same test.
3. Done when: tests route a recordings-and-docs-only range with visual evidence to `reviewer`, and a CSS change with visual evidence to `visual-reviewer`.
