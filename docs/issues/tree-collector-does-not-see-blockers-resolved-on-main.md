---
stage: done
assignee: agent
author: session:01a0f62b-c611-7b38-b9c1-36fdc421abb2
---

A tree collector branch evaluates blockers against its own copy of the tracker, so a blocker that landed on the owner's main after the collector forked stays open there. Observed in arkhai-payments on 2026-10-07: `connect-card-provenance-join` in `tree/connect-payouts` was `blocked-by: credit-top-up`; `credit-top-up` landed on main at febb93f, but the collector still read it as `spec`, nothing was frontier, and the reconciler stopped. Workaround: mark the blocker done on the collector by hand and restart; the unblocked child then had to merge main itself (nine conflicting files between the two features).

Options: when a cross-tree blocker lands on the owner's checkout, merge the owner's branch into collectors that depend on it (surfacing conflicts as an exception), or resolve blocker status against the owner's checkout rather than the collector's copy and have the unblocked child merge first.

## Result

The first option, generalized to any collector: when every blocker holding some open node in a collector is done in the collector's parent branch (the owner's checkout, or the enclosing collector), the reconciler merges that branch into the collector under the integration lock (fabb1e8). Parents catch up before their children are visited, so a blocker on main reaches nested collectors in one pass. A conflicting merge is aborted and raised to the owner with the conflicted files and the collector path; after merging by hand, `retry` resumes. Tried on a scratch tracker: a clean merge unblocked the held child, and a conflicting one aborted and reached the owner as described.
