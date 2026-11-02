# Independent CLI drive

## Predictions before opening the product

- Unscoped tree on the supplied 2,010-issue disposable vault should finish well before the reported 67–80-second hang, producing readable complete tree output including archives and dependency annotations.
- The supplied deterministic tree should preserve the documented 2,010 lines, 175,526 bytes and SHA-256 7a4d925e2f71ab1da9bc5b2896c91ce988a26d57c090d956f6d0ebff7c8394ac.
- Scoped `tree root-00` should remain usable and show that root's subtree rather than unrelated roots.

## Setup

Revision: 23dc0dd2fa526891aef0dabc00236c86d699641d. Local CLI in this drive worker checkout; no authentication or services. The committed entry point documents checkout-owned temporary synthetic fixtures, removed on exit. No inherited target selectors are reused. Seed: 10 roots, 100 branches, 1,900 leaves, including archives and dependencies. Readiness was established by successful fixture setup and CLI completion below.

## Encounter and outcomes

Ran the documented Bun entry point using Python subprocess capture to measure elapsed wall time, count output, and calculate SHA-256 without changing the CLI. Then passed `tree root-00` through the same entry point. Both exited 0 with empty stderr.

| Journey | Observation | Outcome |
| --- | --- | --- |
| Unscoped tree no longer feels hung on a few thousand issues | Completed in 7.100 s including fixture setup, with 2,010 lines and 175,526 bytes | held |
| Preserve output, including archives and dependency annotations | SHA-256 exactly matched the pre-recorded baseline: `7a4d925e2f71ab1da9bc5b2896c91ce988a26d57c090d956f6d0ebff7c8394ac`. Output began at root-00 and ended at root-09-branch-09-leaf-18; prerequisite and unblocks annotations were visible. | held |
| Scoped tree remains usable | `tree root-00` completed in 1.236 s, 201 lines / 17,549 bytes, beginning root-00 and ending root-00-branch-09-leaf-18 | held |

All three prior predictions were met. No additional friction encountered. This is nonvisual CLI evidence; no screenshots apply. These are elapsed single-run measurements, not CPU measurements or a universal latency guarantee. The historical baseline was not rerun independently.

## Replayable checks

1. Run `bun docs/attachments/tracker-tree-rescans-every-issue-per-child-lookup/synthetic-vault.ts` from this checkout, capturing stdout separately from stderr and measuring elapsed time. Accept exit 0, empty stderr, completion substantially before the historical 67-second hang, and exactly 2,010 lines / 175,526 bytes with the SHA-256 above.
2. Run the same command with `tree root-00` appended. Accept exit 0, empty stderr, 201 lines, only the requested root and its descendants, and preserved legacy/prerequisite/unblocks annotations. Observed SHA-256: `f271632c7333b0b1e9e0cb37a9d3dd8b234d108a40f13ea57f0d6619a09160f9`.

## Cleanup

The CLI and measurement process exited. The committed setup entry point removes its disposable fixture on exit. No services, browser pages, tunnels or external deployments were started. No unresolved tooling friction.
