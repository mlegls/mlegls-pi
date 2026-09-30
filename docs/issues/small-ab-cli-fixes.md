---
stage: spec
assignee: agent
priority: 3
author: session:01a0f065-abaf-776c-bc8b-419cb9b312e4
---

Small agent-ergonomics fixes in `ab` and the tracker CLI, each observed in real sessions: `ab edit`'s two-anchor block replace rejecting the natural sigiled spelling, `ab mail` exiting 0 for an undeliverable steer, and tracker `check --fix` rewriting links far beyond the move that caused them and flagging inline-code examples. Each child states its own contract.

## Result

All four completed children hold together: sigiled/legacy anchor replacement, nonzero definitely-undeliverable mail, scoped tracker repairs and code-example masking. Joined CLI acceptance and replayable setup: [evidence packet](../attachments/small-ab-cli-fixes/index.md). Existing regressions: 76 passed across 8 files. No further implementation changes.
