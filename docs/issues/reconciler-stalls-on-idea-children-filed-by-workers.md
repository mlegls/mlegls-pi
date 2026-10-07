---
stage: done
assignee: agent
author: session:01a0f62b-c611-7b38-b9c1-36fdc421abb2
---

A worker filing friction as an `idea` child of the issue it works on stalls the whole subtree: the parent's effective stage drops to idea, nothing is frontier, and the reconciler stops. Observed in arkhai-payments on 2026-10-05: a drive worker on `otc-bank-funded-ledger` filed `otc-bank-ledger-drive-setup-surface` with `part-of: otc-bank-funding`; the reconciler reported "stopped with open work: otc-bank-funding (spec)" after all six real children had landed. Moving the idea out of the tree and restarting resumed it.

Either the reconciler skips idea children when computing readiness and completion (an idea under a dispatched subtree is an observation, not work), or worker prompts file friction outside the dispatched tree (part-of the tree's parent, or no parent). The first is robust to whatever workers do.

## Result

Neither option as written: the tracker's lint already says a child that needs shaping leaves the tree, so the reconciler does that itself rather than reading the tree differently from the tracker. At the root and each collector it finds open `stage: idea` issues anywhere under the node, drops their `part-of` in the branch they landed in (keeping `Filed under [[old parent]]` in the body), commits, and tells the owner to triage them (6b1478a). Tried on a scratch tracker: the idea was set aside in the owner's checkout and the run went on to its next hold.
