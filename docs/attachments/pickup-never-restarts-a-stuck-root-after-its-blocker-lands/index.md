# Pickup after a stuck root changes

Tested `ffff40f4` from the drive worktree. The supplied replay creates and owns a disposable local Git repository and file-backed tracker. It seeds the stuck state and runs as a fake BB supervisor; it needs no credentials, model calls, live project or watcher. Bun and the committed replay entry point are present. The replay performs setup and drive in one invocation:

```sh
bun docs/attachments/pickup-never-restarts-a-stuck-root-after-its-blocker-lands/first-use.ts
```

## Predictions before first use

- Recreate a root stuck at T, then record its blocker's landing in the collector at T+0.5s. Expect pickup to restart the root without an issue edit. With an issue edit after T instead, also expect a restart.
- Scan an otherwise equivalent stuck root with no later changes. Expect it to stay skipped.
- Let a blocker land during the reconciler tick that could declare the root stuck. Expect it to re-check and continue rather than stop with open work on the stale blocker.

## Encounter

The replay exited 0 in four seconds. No separate service or browser was required.

| Check | Action and observed result | Expectation |
| --- | --- | --- |
| Unchanged stuck control | Scan after seeding a stuck root without a later change. `started` was empty and `unchanged-stuck-ticket` was skipped with `has reconciler state (stuck); restart it by hand`. It stayed skipped in subsequent scans. | Met |
| Subtree issue edit | Scan after a subtree issue edit at T+0.5s. The replay selected `joined-5000-profile-practice-and-map-stay-loading` for restart. This leg reports selection only. | Met for pickup selection |
| Collector landing | Scan after a collector receipt at T+0.5s. Pickup started the joined-5000 root. The next scan started nothing, and the replay observed `finish-joined-5000-practice-implement-1` launch based on the delivery with the receipt retained. | Met |
| Same-tick re-check | The replay reports recovery of an already-stuck root. Its output does not show a blocker landing inside the tick that was about to mark a root stuck. | Unobservable; remains with this ticket for review |

## Remaining check

Begin a reconciler tick with a dependent waiting on a blocker. Record the blocker delivery into the collector during that tick, before its stop decision. Accept if the dependent becomes runnable or launches and the reconciler does not report `stopped with open work` on account of that blocker. A subsequent pickup scan that revives a stuck root would exercise the other recovery path and cannot establish this claim.

No tooling friction encountered. The manual-restart skip message matched the unchanged control.

## Review and re-drive

**Same-tick re-check: held after repair.** Run `bun docs/attachments/pickup-never-restarts-a-stuck-root-after-its-blocker-lands/same-tick.ts`. The blocker starts in integration with a reviewed commit on its worker branch; the collector has no landing receipt yet. With 60 seconds between ticks, the original walk recorded the delivery but still had no dependent worker after 15 seconds: the integrating sibling returned `active`, even though the walk had seen a held dependent. After the repair the run logged `landed blocker in root` followed by `launched dependent-implement-1`. The dependent's HEAD matched the reviewed commit 2.12 seconds after startup, before a second tick was possible. Pickup was disabled throughout.

**Pickup claims: held on re-drive.** `first-use.ts` again selected the edited tree, restarted on the T+0.5s receipt, launched the dependent at that commit and skipped the unchanged ticket. A selection probe also caught the non-frontier restart path offering an edited `user:owner` ticket to an agent. After repair the same probe skipped `human`, `user:owner`, `session:owner` and unassigned tickets.