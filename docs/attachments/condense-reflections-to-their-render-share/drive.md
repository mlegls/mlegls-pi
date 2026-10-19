docs/attachments/condense-reflections-to-their-render-share/drive.md (14 lines)
# Independent first-use drive

Revision: c1bced1e4e28a57d7e57d4c4cd45154e24792cb9.

## Predictions before use

- A 200k-window session will condense an over-share reflection pool before rendering, with max equal to half the summary budget and target about 75% of max.
- Explicit max/target settings will remain effective.
- Under render omission, old role and constraint reflections will survive ahead of newer ordinary reflections.
- Relevance ranking will run only on omission; unavailable/erroring Jev will fall back to recency after the protected set.

## Prepared encounter

The supplied entry point is a checkout-owned offline library fixture, no authentication, scripted worker responses and temporary database cleanup. I will run that exact entry point from this worktree, not inspect its source or treat test-suite success as first-use evidence. No browser or shared deployment is involved.
## Encounter results

Both exact entry-point invocations completed successfully (exit 0), without stderr, on this checkout. Readiness was established by successful fixture initialization and completion; no shared URL, inherited deployment selector, credentials or persistent deployment was used. Temporary database creation/cleanup is the supplied setup contract, not independently inspected implementation.

| Claim / expectation | Action and observation | Outcome |
| --- | --- | --- |
| Small-window budget drives condensation | Default invocation: session 200,000, worker 1,000,000; summary 25,000, max 12,500, target 9,375. Pool 20,203 tokens / 122 reflections became 59 tokens / 3 reflections. Worker calls: reflector, condenser, condenser. | met |
| Explicit limits win | Printed max-only 2,000/1,500; target-only 12,500/40,000; combined 2,000/600. | met |
| Omission protects old role/constraint | Before condensation, 47 omitted, roleKept and constraintKept true; newest ordinary retained, oldest ordinary not retained. After condensation roleRendered and constraintRendered true. | met |
| Large window avoids unnecessary condensation | Positional argument 1000000: summary 125,000, max 62,500, target 46,875; no omissions; reflector only; all 122 reflections / 20,203 tokens remain. | met |
| Jev only on omission / fallback | Existing setup documentation explicitly chooses ticket-permitted no-Jev fallback because classifier credentials are separate from worker authentication. Observed ordinary newest-first behavior is consistent with that choice. No live inference or latency claim. | fallback observed; live Jev not applicable |

## Frictions and limits

No failed encounter or tooling friction. This supplied public-library encounter exposes aggregate outcomes rather than a Pi interactive session; worker inference is scripted. It demonstrates role/constraint preservation, not every wording of preferences, permissions or blockers. That broader recognizer coverage belongs to the following reviewer, alongside the ticket-authorized automated tests. Two condenser calls were visible but no error or incomplete reduction resulted; no explanation inferred without source inspection. Target-only override exceeds max; this matches the explicit-values-win contract, rather than implying default normalization.

## Replayable checks

1. Run `bun docs/attachments/condense-reflections-to-their-render-share/first-use.ts`. Accept max 12,500 and target 9,375 despite the worker's 1M window; condenser present; reduced pool under max; roleRendered and constraintRendered true.
2. In the same output, accept omitted > 0 with roleKept/constraintKept true and oldestOrdinaryKept false. This distinguishes preservation priority from pure newest-first.
3. Run the entry point with positional argument `1000000`. Accept max 62,500/target 46,875, omitted 0, no condenser call and the unchanged pool.
4. Inspect printed override resolutions: accept the explicit max and target independently, including target-only 40,000.
5. Reviewer check not exercised by this fixture: use old preference, standing-permission and open-blocker reflections under omission; accept them before newer ordinary records. No driver claim that those categories were independently exercised.

No rendered UI journey; no screenshots. Both owned processes finished; no server, tunnel or browser remains.

## Review

- The preservation recognizer was too broad: "should", "only", "requires", "allows", "because" matched most ordinary reflections, so the floor degenerated toward "everything". Narrowed to the ticket's categories (role/identity, preferences/permissions, constraints/rules, blockers, decisions/rationale). Wording coverage for preferences, permissions and blockers is now asserted in `session-ledger/render-summary.test.ts` (role and constraint) with the budget derivation and explicit-override cases.
- Re-ran the entry point at 200k and 1M after the change: 200k still triggers the condenser (122 → 3 reflections, role and constraint rendered; backstop omits 47, keeps role/constraint/newest); 1M still fits with no condensation.
- `bun test extensions/context/om` 6 pass; `bunx tsc --noEmit` clean. Jev skipped (needs separate classifier credentials, renderer is synchronous): accepted per the ticket's optional clause.
