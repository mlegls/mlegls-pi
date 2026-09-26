---
stage: done
author: session:2026-09-26T09-29-46-063Z_01a0dd0c-9b4f-7795-aad1-0299963801cf
---

September 26 Concept workers report shared chrome-devtools-axi snapshots switching tabs, and refs becoming stale after screenshot, eval or wait. Workarounds were named CHROME_DEVTOOLS_AXI_SESSION sessions, new pages, resnapshotting, and eval/CSS locators. Another report says fill appended at the caret.

Investigated: target mismatch occurred in unqualified CLI calls; the named-session stale-ref trace reused a ref after a click. An isolated 0.1.35 probe kept sessions separate, retained usable refs across screenshot/read-only eval/wait, and replaced a plain input's value. A DOM mutation invalidated refs as designed. The snapshot-only attribution and general fill-append claim were not reproduced; controlled inputs remain outside the probe's scope.

The shared worker prompt now requires unique named CLI sessions on every invocation, fresh refs after changes, and ownership-aware cleanup. Existing named-session support owns isolation; no wrapper or external package patch. Explicit shared endpoints/profiles still require exclusive page assignment. Conservative mutation-based invalidation is accepted rather than disabled. [Original receipts, live results and limits](../research/browser-cli-ownership-2026-09-26.md).

[Session evidence and dispositions](../research/session-friction-review-2026-09-26.md).
