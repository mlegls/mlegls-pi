---
stage: ticket
author: session:01a0f065-abaf-776c-bc8b-419cb9b312e4
priority: 4
assignee: "agent"
---
Done: `maskMarkdownCode` in `skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts` also masks CommonMark indented code blocks (4+ spaces or a tab, starting after a blank line or document start, not a list item's continuation), so wikilinks inside them are not checked. Wikilinks in indented list continuations stay checked. Tests in the tracker scripts suite cover both cases.

`maskMarkdownCode` in the tracker check masks fenced blocks and inline code spans, but not four-space indented code blocks. Wikilinks inside indented code are still checked as real links. The reviewer of [[projects/mlegls-pi/issues/archive/tracker-check-flags-inline-fixture-wikilinks]] noted this as outside that ticket's contract.
