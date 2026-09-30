---
stage: idea
assignee: agent
author: "session:01a0e98c-8121-747b-a4b2-db117e3e5a98"
blocked-by: []
---

Owner: `mlegls-pi` supervision handoff, not the Application. The study feature-use verifier received a literal `null` implementer setup handoff on 2026-09-28. There was no deployment kind, owned target, persona/auth, seed/adoption state or entry point. The project docs supplied an authorized fallback (`mise install`, `mise run setup`, `mise run local`, `mise run seed`), and the driver prepared an isolated local target, but Hub → Installed listed zero adopted Patches. The public collection was not inspected. Thus this browser journey can exercise study operations but cannot establish positive official-Node feature-use emission. An earlier first-use API trial was separate and in-memory.

Workaround: prepare the checkout-owned local deployment from project docs, report the adoption gap and independently exercise reachable operations. Proposed improvement: have the implementer supply the study drive's adopted official-Patch seed/operation readout and runnable entry point, or label the missing handoff as a deliberate setup task rather than passing `null`.

Related: [[projects/mlegls-pi/issues/drive-handoff-names-the-implementers-worktree-ports]]. The Concept seed side is [[projects/concept/issues/seed-the-states-drives-keep-finding-empty]].

Another encounter, 2026-09-30: the board fixture typecheck driver also received a literal `null` setup handoff. The ticket supplied the root typecheck command and README supplied `bun run setup`; the checkout-local, nonvisual journey completed without auth, seed or services. Workaround succeeded, but the setup had to be inferred. Evidence: [board drive packet](../attachments/root-board-store-fixture-typecheck/index.md). This is the same supervision handoff owner, not a board-store defect.

2026-09-30: the sentinel parser's [library drive](../attachments/turn-end-sentinel-parser-rejects-preambles/index.md) also received a null setup handoff. The driver discovered `ab lib report` exports and used checkout-owned `parse(text)` through Bun; no deployment or credentials were needed. This cost an exploratory call rather than blocking the story. The packet now records the runnable entry point. The same proposed handoff improvement applies to library-only drives.

2026-09-30, ab resource-list drive: another literal null setup handoff required discovering that PATH `ab` and inherited `AB_STATE` target the canonical checkout/per-user daemon. The driver used checkout `./bin/ab` with a fresh worktree-local `AB_STATE`, observed readiness via daemon responses, and shut down only that daemon. All list stories held after this preparation. This is the same missing-handoff friction, now on a CLI journey; supply the checkout entry point and isolated state selector, not just a daemon-version warning. [Encounter](../attachments/ab-check-list-truncates-machine-readable-json/index.md).
