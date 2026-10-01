---
stage: done
assignee: agent
author: session:01a0f2a3-2933-716b-91f8-7f1d50eba567
part-of: "[[projects/mlegls-pi/issues/archive/supervisor-hibernation]]"
---

Supply the C arm of [[projects/mlegls-pi/issues/archive/supervisor-hibernation]]: hibernate with an empty journal, rebuilding from the job, ledger and issues on wake. `memory.journal` is currently parsed/defaulted in `extensions/memory/index.ts` but never consulted; setting it false is not yet this arm.

Make C explicitly selectable through the existing memory configuration, with the default H path unchanged. C must discard prior journal content as well as omit a new journal, not fall through to native summarization or disguise a summary as resumption instructions. Keep artifact rereading and recall of originals available. Preserve session/branch cancellation and continuous-tail safety; document exactly which verbatim conversational tail, if any, survives so the comparison can account for it rather than claiming an entirely fresh context.

Try one empty-journal hibernation and its next wake through Pi's public session surface. Show durable `trigger: hibernate` metadata, no retained/generated journal and successful artifact-based resumption. Commit verifier-needed setup and a launch recipe. Run existing memory regressions and type checks; permanent acceptance tests belong to the following reviewer.

This is an experimental selector, not a change to production defaults or compaction register wording. [[projects/mlegls-pi/issues/archive/supervisor-hibernation-comparison]] consumes it.
## Result

`memory.journal: false` selects the empty-journal hibernation path; the default remains `true`. The live same-session wake reread the issue, job and ledger, and original-entry recall still works. [First-use encounter and evidence](../attachments/supervisor-hibernation-empty-journal/index.md).

## Verification evidence

- `bun test extensions/memory lib/memory.test.ts`: 22 passed, 0 failed, 215 expectations.
- Focused memory TypeScript check passed:

  ```sh
  bun node_modules/typescript/bin/tsc --noEmit --skipLibCheck --target es2023 \
    --module esnext --moduleResolution bundler --allowImportingTsExtensions \
    --types bun-types extensions/memory/index.ts extensions/memory/core.ts extensions/memory/memory.test.ts
  ```
- The first-use packet records the persisted empty hibernation entry, the same-session artifact reads and successful original-entry recall. No permanent acceptance test was added.
