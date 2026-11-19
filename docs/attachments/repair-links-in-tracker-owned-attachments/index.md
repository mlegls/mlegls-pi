# Repairing links in tracker-owned attachments

## Predictions before first use

As a worker in a linked worktree, I expect the vault check to name the Markdown attachment containing a dangling link. I expect to pass that attachment identifier to the global tracker, read the packet, change the stale link there, and see the change in the canonical vault. On recheck, the repaired citation should no longer be reported. Direct worktree access should still be guarded, and accepting an attachment identifier should not give me a way to bypass ownership checks on issues.

## Setup

Tested revision: `ab55a16d`. From the checkout root, run `bash docs/attachments/repair-links-in-tracker-owned-attachments/drive.sh`. The handoff describes a disposable local Common Concept vault and linked worker worktree seeded at `73dabc569416a5b6add49110440c1bd33d4be279`, using local Git and Bun without credentials or network services.
