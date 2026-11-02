# Tracker tree child-index implementation trial

Independent user-surface verification: [CLI drive predictions, encounter and replay checks](drive.md).

`children`: scan the entire issue map on every lookup → build one child index per map, then look up by parent slug. The cache preserves map insertion order and includes archived children. Candidate edits use a fresh map; the immutability requirement is documented beside the cache.

## Setup and entry point

- Tested implementation: `48502328297212dfe06d6b963900b69595d63d1b`; baseline code: `31026c8ce8feb059b0bfbfef8af1a4f99100c4d5`.
- Required/prepared environment: local Bun CLI in the worker checkout. No services, persona, authentication, or secrets.
- [synthetic-vault.ts](synthetic-vault.ts) seeds a checkout-owned disposable directory under the OS temporary directory, invokes the checkout's CLI directly, and removes the fixture on exit. It does not read or write a real project tracker.
- State: 10 roots, 100 branches, and 1,900 leaves, including 100 archived leaves, dependency edges, and one legacy record. Inflight overlays are disabled for reproducibility.
- Readiness observed: fixture setup and CLI execution both completed successfully.

From the checkout root, this command opens the story's unscoped tree surface:

```sh
bun docs/attachments/tracker-tree-rescans-every-issue-per-child-lookup/synthetic-vault.ts
```

Optional CLI arguments pass through, for example `tree root-00` or `snapshot --json`. Prefix with `/usr/bin/time` to repeat the wall-time measurement; pipe to `sha256sum` to compare the tree digest below. To repeat the baseline, use the same fixture in a checkout of the baseline code.

## Evidence

This is a nonvisual implementation trial, not independent acceptance.

| Criterion | Before | After |
| --- | --- | --- |
| Unscoped tree wall time, including disposable fixture setup | 661.998 s | 8.286 s |
| Exit status / stderr | 0 / empty | 0 / empty |
| Output | 2,010 lines; 175,526 bytes | Byte-identical |

The final run was about **79.9× faster** (98.75% less elapsed time). Both outputs had SHA-256 `7a4d925e2f71ab1da9bc5b2896c91ce988a26d57c090d956f6d0ebff7c8394ac`; a direct string comparison also matched. The baseline was started before the code edit and ran concurrently with other checks for part of its duration. An initial indexed run under that concurrent load took 14.719 s with the same digest; the table uses the final indexed run after those jobs ended. These are single-run wall times on this host, not CPU measurements or a latency guarantee for other vault shapes.

Existing checks:

- `bun test --cwd skills/enabled/all/mlegls/conventions/tracker/scripts`: 33 passed, 0 failed, 719 assertions. This includes lifecycle projection, archived children, dependency ordering, closing candidate maps, and mutation persistence.
- `bun run typecheck`: passed.
- `git diff --check`: passed.

No permanent acceptance tests were added by the implementer. Candidate reviewer regression: unscoped `tree` on a synthetic vault of a few thousand issues must not rescan all issues for each child lookup.

## Danger

**Door:** two-way; no persisted data or format changes.

**Blast radius:** tracker. Any caller that mutates an issue map after its first child lookup could observe a stale index; existing candidate-edit paths populate fresh maps before querying them.

## Review

Reviewed the child-index change; its map-immutability invariant holds (`publish` mutates its map before the first `validateGraph` lookup; `close` uses a fresh `candidate` map).

Repair: `dependents()` ran `complete()` (a recursive `effectiveStage`) on every issue before checking `blockedBy`, so `tree` stayed quadratic after the index (7.96 s on the synthetic vault; `snapshot --json` 0.44 s). The two conditions now run in the cheaper-first order; behavior is unchanged.

Re-drive after the repair: `bun docs/attachments/tracker-tree-rescans-every-issue-per-child-lookup/synthetic-vault.ts | sha256sum` gives the same digest (`7a4d925e…94ac`) in 0.41 s including fixture setup. Tracker tests: 36 pass, 0 fail.

