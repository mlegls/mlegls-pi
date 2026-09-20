---
next: done
---

From [[directing multi-agent work]]: separate parent-owned Gantt-style concurrency planning from launching workers. The parent autoreads, plans streams, routes delegated assignments, dispatches a ready wave, and integrates/replans after reports.

2026-09-20: implemented `lib/dispatch.ts` as the BB/workmux launch boundary; `realize` is the planning skill. Introduce/advance and general worker stances now refer to realize. The old classifier moved to `lib/classify.ts`; its measurement issue stays open. Introduce/advance's Jev-driven briefing workflows are not implemented by this change.

Shape and importing examples: [dispatch](../../dispatch.md). BB uses native global/host admission; workmux checks a parent-supplied outstanding-worker budget and returns unattempted assignments. No scheduler, automatic retry, or global workmux lock. Shared roster parsing moved to `lib/agents.ts`; workmux accepts an execution-command override while retaining the agent stance/checkpoint.

Verification: library/module/kernel subset 21 pass, 1 skip. Full suite 179 pass, 2 skip, 17 fail and 1 error; affected board/session tests and the two exec terminal/board failures reproduce on starting commit `3d5b695`. Typecheck reports only the five existing Exa/session/system-prompt errors. Intercepted CLI smoke runs under Bun and Node verified BB parent/host/model/effort forwarding, literal prompt stdin, partial launch receipts, workmux admission/pending assignments, and duplicate-handle preflight. These are adapter checks, not live worker verification; no worker was launched.

Friction: [[projects/mlegls-pi/issues/workmux-status-malformed-pane]]. Workmux's native concurrency flag only covers one invocation's targets; parent-scoped admission avoids building a scheduler for separately prompted assignments. Cross-parent workmux admission remains outside this boundary.

SCC delta against `3d5b695`, over lib, agents, orchestration and lifecycle skills: code 1971 → 2091 (+120), complexity 362 → 414 (+52). The increase is the backend launch/receipt/admission path; classification was moved, not duplicated. Used installed SCC 4.1.0 explicitly because the default mise shim has no active version.
