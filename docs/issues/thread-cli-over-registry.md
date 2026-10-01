---
stage: done
assignee: agent:fill
author: session:01a0f6e1-7ec3-7620-b7fd-edc63c2b3d94
part-of: "[[projects/mlegls-pi/issues/thread-core-and-workers-on-zmx]]"
priority: 2
---

Session mode: hacking. Preserve [[projects/mlegls-pi/stories/work-in-threads]]. The decisions in [[projects/mlegls-pi/issues/thread-registry-on-zmx]] and the `lib/thread/index.ts` API are the contract. Source evidence: [zmx/pi launch constraints](../attachments/thread-core-and-workers-on-zmx/source-contract.md).

Implement `lib/thread/cli.ts` and route `ab thread …` from `bin/ab`. Keep `ab tree` and the existing sidebar reload loop intact; do not migrate their UI here. Use the index API, not duplicate git/zmx/registry logic.

## Edits

Implement the exact command grammar in [[projects/mlegls-pi/issues/thread-registry-on-zmx]]. `new` maps in/worktree/base/parent/prompt/cmd into `NewThreadOptions`; `fork` takes its source from PI_SESSION_ID (prefer PI_SESSION_FILE when present) and accepts the existing worktree flag. Also accept `fork --in <cwd>` as the internal workspace-command destination route: the sibling must fork history into that cwd, not silently start a blank session there. `promote [session]` defaults to current PI_SESSION_FILE/ID. Resolve current sessions through the registry; invalid/missing/ambiguous ids and mutually exclusive destinations fail before side effects.

`ls --json` prints one JSON array of ThreadRow from listThreads, default spawn tree, optionally merge. The non-JSON route renders that same order/depth, ids, canonical-session identity, cwd/branch, ownership, working/idle/exited, report and blocked marker without requiring session-file scans in the CLI. Default excludes archived/free sessions. Creation prints the created ThreadRecord as JSON so pi commands can attach by its id; no setup chatter mixed into that stdout.

`attach` inherits stdio and delegates role creation/attachment. `send <id> [text]` takes remaining text as literal input, or stdin when omitted; it adds no CR. `history` prints plain history. `archive/abandon` print ThreadCleanup JSON; a blocked archive has a nonzero exit with its thread marker, not a success. `merge` calls the same archiveThread handler as `archive`: identical post-order retirement, guest handling, conflict routing and blocked/resume behavior, as answered in [[projects/mlegls-pi/issues/thread-merge-command-lifetime]]. Do not add a separate merge-only lifecycle path. Usage errors/nonzero backend results go to stderr and nonzero exit; do not swallow partial failures.

## First use / acceptance

After `mise run setup`, drive the checkout's `bin/ab thread …` against a temporary owned git fixture, with isolated state/board and labelled zmx terminals. Exercise new → ls in both orders/JSON → fork → literal send/history → attach an aux shell → archive, plus guest promote/abandon. Repeat the archive journey through `merge`, including a child conflict/blocked-resume and a guest, to verify the alias has the same outputs, exit behavior and cleanup. Show CLI id/current-session/ownership and depth agree with registry records; JSON creation remains parseable when setup logs. Re-run `ab tree` without opening shared UI to prove routing was preserved. Supply exact fixture commands/ids for the driver, then remove all created fixture resources. Run existing regressions and typecheck. No native desktop/browser required.

## Result

[Independent CLI first use and review](../attachments/thread-cli-over-registry/index.md): creation/listing, literal input, auxiliary attachment, promote/abandon, archive and merge conflict/blocked/resume held. The reviewer repaired current-file fork lineage and retained C2 in `lib/thread/cli.test.ts`; ambiguous worker aliases are covered by `lib/thread/runtime.test.ts` (C3). [Core join](../attachments/thread-core-and-workers-on-zmx/index.md) replays the stale-id fork and both CLI lifecycle paths after the worker cutover. All owned fixtures were removed.

## Verification evidence

[Encounter and evidence](../attachments/thread-cli-over-registry/index.md).
