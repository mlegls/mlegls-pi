---
stage: ticket
assignee: agent
author: session:01a0f2a3-2933-716b-91f8-7f1d50eba567
part-of: "[[projects/mlegls-pi/issues/supervisor-hibernation]]"
---

Supply the C arm of [[projects/mlegls-pi/issues/supervisor-hibernation]]: hibernate with an empty journal, rebuilding from the job, ledger and issues on wake. `memory.journal` is currently parsed/defaulted in `extensions/memory/index.ts` but never consulted; setting it false is not yet this arm.

Make C explicitly selectable through the existing memory configuration, with the default H path unchanged. C must discard prior journal content as well as omit a new journal, not fall through to native summarization or disguise a summary as resumption instructions. Keep artifact rereading and recall of originals available. Preserve session/branch cancellation and continuous-tail safety; document exactly which verbatim conversational tail, if any, survives so the comparison can account for it rather than claiming an entirely fresh context.

Try one empty-journal hibernation and its next wake through Pi's public session surface. Show durable `trigger: hibernate` metadata, no retained/generated journal and successful artifact-based resumption. Commit verifier-needed setup and a launch recipe. Run existing memory regressions and type checks; permanent acceptance tests belong to the following reviewer.

This is an experimental selector, not a change to production defaults or compaction register wording. [[projects/mlegls-pi/issues/supervisor-hibernation-comparison]] consumes it.
