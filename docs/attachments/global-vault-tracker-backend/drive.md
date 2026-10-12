# Independent CLI encounter

## Predictions before first use

Tested revision: `46c9d650a70cc1c0aead4a189a53dcb0427aa848`.

Setup: checkout setup completed per supplied handoff. Entry point is `bun docs/attachments/global-vault-tracker-backend/rehearse.ts`; it owns a temporary git fixture, sets fixture author/provenance, seeds the canonical vault and sparse shell worker, and cleans only its own target. No services or credentials required. Readiness will be observed in the rehearsal output rather than inferred from previous success.

1. Sparse worker: expect no physical issue directory, retained attachments, and identical canonical CLI/library reads, including updates without worker HEAD changing.
2. Maintainer writes: expect field/body edits and close/remove to affect canonical files; invalid edits must be inert; unrelated staged sentinel must remain outside persistence commits. Expect close replay not to duplicate evidence.
3. Landing helper: expect code/evidence branch acceptance and explicit rejection listing tracker additions/modifications/deletions without destination mutation.
4. Existing regression commands: not run by this driver; these are implementer/reviewer gates, not a maintainer surface.

## Session log

Predictions recorded before running the entry point. Implementation, tests and fixture source were not inspected.

Ran the committed entry point on 2026-10-12. It completed in four seconds with exit 0. Actual owned target: `vault-first-use-bC7RDT` beneath the OS temporary directory, containing its own main repository and linked worker. First readiness observation: sparse preparation reported tracker absent, attachments present, and no tracked deletions. Cleanup reported removal of only that fixture directory. No server or browser was started.

| Story / expectation | Observed outcome |
| --- | --- |
| Sparse canonical reads — met / held | Shell worker returned seed; library returned lifecycle projection with canonical main issue path; subdirectory and symlink fields matched. Later snapshot showed priority 1 with unchanged worker HEAD. |
| Maintainer writes — met / held | Create returned logical `part-of: seed`, nested metadata and explicit provenance; stored relation was a quoted vault-absolute link. Field merge preserved `Seed contract.`; empty replacement reported true. Concurrent updates retained both values. Invalid cycle left text and HEAD unchanged; provenance alteration and traversal were explicitly rejected. Close replay retained identical text/HEAD, removed claim and issue blocker, kept guard, and did not copy evidence. Provisional remove succeeded. Sentinel remained staged and never committed. |
| Refusal helper — met / held | Code/evidence branch accepted. Forbidden branch rejected with `docs/issues/child.md`, `docs/issues/hidden.txt`, `docs/issues/seed.md`, and instruction to mutate through tracker. Destination remained untouched. |
| Persistence failure clarity — met | Deliberate fixture hook refusal reported `Validated tracker working-tree write happened`; validated write visible, no commit. |
| Regression gates — unobservable here | Driver did not run repository tests or typecheck. Existing implementer results remain in index; reviewer owns these gates. |

## Frictions

No user-surface friction encountered in this replay. The entry point is an automated guided CLI/library rehearsal: its summarized observations do not expose every individual command to a maintainer. No independent ad hoc exploratory session or production runtime integration was attempted.

## Replayable checks

Run `bun docs/attachments/global-vault-tracker-backend/rehearse.ts` from this checkout after setup. Accept sparse preparation only with `trackerAbsent`, `attachmentsPresent`, and `noTrackedDeletions` true. Accept freshness only with `sameHead: true` and priority 1. Accept rejected writes only with both unchanged text and HEAD. Accept close replay only with unchanged text/HEAD, done stage, absent claim, retained guard and evidence not copied. Accept persistence isolation only with sentinel still staged and never committed. Accept refusal only when all three named issue paths appear and destination is untouched. Accept completion only with fixture-scoped cleanup and exit 0.

Nonvisual evidence, no screenshots. This packet records the independently executed committed rehearsal, not independent inspection of its internals.
