---
stage: "done"
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

## Result

done. Here's the handoff again, with Concept's commit listed under its checkout.

```yaml
commit:
  - checkout: /home/mlegls/dev/mlegls-pi__worktrees/visual-review-only-for-changes-that-render-something-new-review-3
    commits: [5e5f536c]
  - checkout: /home/mlegls/dev/mmon/concept
    commits: [5fdbb4d4c5]
stories:
  - {story: "Recordings and docs with visual evidence route to reviewer", outcome: held}
  - {story: "CSS with visual evidence routes to visual-reviewer", outcome: held}
  - {story: "The join uses the same routing rule", outcome: held}
  - {story: "The ordinary reviewer still opens the shots", outcome: held}
evidence:
  path: docs/attachments/visual-review-only-for-changes-that-render-something-new/index.md
  visual: false
  shots: []
tests: []
fixed:
  - "concept 5fdbb4d4c5: commits .pi/reconcile.json renderedPaths. Without it this change would send every Concept visual packet to reviewer."
filed: []
caveats:
  - "Join and shot-opening stories held by reading reconcile.ts startPhase and the review prompt; no replay exposes the join's role filter."
  - "Non-join reviews are now pinned to reviewer or visual-reviewer, so the stance picker no longer runs for them; tidy stays join-only."
  - "review-routing.test.ts runs two fake-BB reconciler replays, ~26s total, nothing shared between them."
  - "Concept's `*.css` glob also matches CSS under docs/ (design mockups, evidence screens such as docs/attachments/*/screens/bb.css), so a driver committing evidence CSS still invites visual-reviewer. These are the ticket's paths as given, left unchanged."
  - "A malformed renderedPaths throws when a review launches mid-run, the same way a bad `land` value throws at start."
```

Evidence: [docs/attachments/visual-review-only-for-changes-that-render-something-new/index.md](../attachments/visual-review-only-for-changes-that-render-something-new/index.md)
