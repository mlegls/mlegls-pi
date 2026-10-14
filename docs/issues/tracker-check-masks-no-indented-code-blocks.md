---
stage: done
author: session:01a0f065-abaf-776c-bc8b-419cb9b312e4
priority: 4
assignee: "agent"
---
Done: `maskMarkdownCode` in `skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts` also masks CommonMark indented code blocks (4+ spaces or a tab, starting after a blank line or document start, not a list item's continuation), so wikilinks inside them are not checked. Wikilinks in indented list continuations stay checked. Tests in the tracker scripts suite cover both cases.

`maskMarkdownCode` in the tracker check masks fenced blocks and inline code spans, but not four-space indented code blocks. Wikilinks inside indented code are still checked as real links. The reviewer of [[projects/mlegls-pi/issues/archive/tracker-check-flags-inline-fixture-wikilinks]] noted this as outside that ticket's contract.

Verification: [driver encounter packet](../attachments/tracker-check-masks-no-indented-code-blocks/index.md). CLI encounters held; suite coverage remains for reviewer/integrator verification.

## Result

done

The `maskMarkdownCode` change in `issues.ts` holds against the ticket, and I made no repairs. `bun test issues.test.ts` in the tracker scripts passes (24 tests, 0 failures). That includes the new test covering tab and space code, list and paragraph continuations, and CRLF. I appended a review note to the driver's packet and committed it as `25ae7d3c`.

```yaml
commit: 25ae7d3c
stories:
  - story: Indented code wikilinks are ignored
    outcome: held
  - story: Indented list continuation wikilinks remain checked
    outcome: held
evidence:
  path: docs/attachments/tracker-check-masks-no-indented-code-blocks/index.md
  visual: false
  shots: []
tests:
  - skills/enabled/all/mlegls/conventions/tracker/scripts/issues.test.ts
caveats:
  - Indented code directly after an ATX heading or a closing fence, with no blank line before it, is still checked as prose. CommonMark would treat it as code, but this errs towards reporting links.
  - The diff against the base also carries other tickets' commits (board, thread, outline-read, setup-project). I reviewed only the tracker-check change.
```

Evidence: [docs/attachments/tracker-check-masks-no-indented-code-blocks/index.md](docs/attachments/tracker-check-masks-no-indented-code-blocks/index.md)
