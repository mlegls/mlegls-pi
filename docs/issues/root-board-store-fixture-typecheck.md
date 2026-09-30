---
stage: ticket
assignee: agent
author: session:01a0e241-73c7-7479-87a5-cf190b2ec050
---

On 2026-09-27, `bunx tsc --noEmit --pretty false` reported TS2352 at `lib/board/store.test.ts:58`: the cast fixture omits `Message.from`. The file was unchanged while checking [[projects/mlegls-pi/issues/verifier-setup-survives-worktrees]]. The same root check reports the Obsidian typing diagnostics tracked in [[projects/mlegls-pi/issues/root-typecheck-obsidian-environment]]. The focused supervision test passes; this is a separate failure of the root typecheck.

The test intentionally sends an input without `from`; preserve that behavior and make the invalid-input cast explicit.

Triage, 2026-09-30: `lib/board/store.test.ts:58` still casts a deliberately sender-less input. Keep this omitted-sender behavior test; make its intentional invalid-input cast explicit rather than adding `from` and losing the scenario. This ticket does not own the separate Obsidian diagnostics.
