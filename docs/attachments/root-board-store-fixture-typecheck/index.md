# Sender-less board fixture: first-use drive

## Predictions (written before running the product)

From the ticket and README, the surface is the root CLI typecheck, not a rendered UI. Running `bunx tsc --noEmit --pretty false` in this checkout should no longer report TS2352 for `lib/board/store.test.ts:58`; it may still report the separate Obsidian diagnostics. The test's omitted-sender scenario should still be exercised successfully by the focused board test. The root typecheck is therefore not expected to exit successfully overall. I expect no authentication, seed or running service to be needed for these commands.

## Setup and encounter

- Tested revision: `4f539a2` (`root-board-store-fixture-typecheck-drive`), checkout `/Users/mlegls/dev/mlegls-pi__worktrees/root-board-store-fixture-typecheck-drive`.
- Setup handoff was `null`. For this root developer-CLI journey, the ticket supplied `bunx tsc --noEmit --pretty false` as entry point; README supplied `bun run setup` for this worktree. Target was the checkout-local installed dependencies and CLI, with no service, seed or authenticated persona. `bun run setup` finished successfully with all four installs unchanged. Root `node_modules` existed before setup. No inherited deployment selector or shared target was used.
- No browser or rendered UI was involved (`visual: false`).

## Stories and observations

1. **Root typecheck no longer rejects the deliberately sender-less board fixture.** Ran `ab check -- bunx tsc --noEmit --pretty false` from this worktree. The command exited 2, reporting memory and Obsidian diagnostics, but none for `lib/board/store.test.ts` (in particular, no TS2352 at line 58). This holds for the requested board diagnostic, not for root-wide typecheck success. The output also included `extensions/memory/images.test.ts` TS2339 and `extensions/memory/index.ts` TS2769, which the ticket did not predict or own.
2. **Omitted sender remains a tested scenario.** Ran `bun test lib/board/store.test.ts`: 11 passed, 0 failed. The observable test names include “missing sender metadata is normalized; malformed records don't poison readers” and “send normalizes omitted sender metadata from scripts and rejects malformed input.” This shows the public test command still executes that behavior; I did not inspect source, test fixtures or diffs.

## Expectations

- **Met:** no board fixture TS2352 appears in the root typecheck output.
- **Met:** board tests exercise omitted sender behavior and pass.
- **Met:** root check remains non-green with Obsidian typing errors.
- **New observation:** memory typing diagnostics also appeared; the prediction did not rule these out.
- **Met:** no authentication, seed or running service was needed.

## Frictions

- The implementer's setup handoff was `null`; I had to infer checkout target and setup command from the ticket and README. This did not prevent the drive.
- Root typecheck's nonzero exit and unrelated diagnostics make a green-exit check inappropriate for this ticket. A reader has to inspect the diagnostics for absence of the board error.

## Replayable checks

- From revision `4f539a2`, run `bun run setup` then `bunx tsc --noEmit --pretty false` at repository root. Accept if there is no diagnostic for `lib/board/store.test.ts`, especially no TS2352 at line 58; do **not** require exit 0 while unrelated diagnostics remain.
- Run `bun test lib/board/store.test.ts`. Accept if the two named omitted-sender cases are reported as passing and the command exits 0. For runtime normalization of a sender-less message, this test output is indirect evidence only; a future public-library regression check should send an input omitting `from` into a disposable board store and assert its readback has normalized sender metadata.

## Review, 2026-09-30

Reviewed `dd0836c..d63f505` against the ticket and the public store API. The `unknown` bridge explicitly admits the deliberately invalid typed input without adding `from`, changing production behavior or suppressing unrelated diagnostics. No implementation defect found.

The existing `lib/board/store.test.ts` tests already replay both omitted-sender routes using disposable stores. Added packet citations and strengthened the script-send check: readback must equal the sent message with the original topic/tags/body and normalized `from: {}`, rather than merely counting one record. This closes the driver's readback evidence gap through the public library surface. The type-level replay remains the existing root TypeScript check over that test file; no nested compiler runner or permanent exception for unrelated diagnostics was added.

Final reviewed source (this review commit, based on `d63f505`):

- **held — root fixture typecheck:** `ab check -- bunx tsc --noEmit --pretty false` exited 2; no diagnostic mentions `lib/board/store.test.ts`. The final-source check ID was `5ae85b41-2879-4ebd-8bec-2a35ca01fe42`. Memory TS2339/TS2769 and Obsidian diagnostics remain.
- **held — omitted-sender behavior:** `ab check -- bun test lib/board/store.test.ts` passed 11/11 with 39 assertions, including both named omitted-sender cases and the new normalized readback assertion. `ab check -- bun run test:board` passed 29/29 with 115 assertions. `git diff --check` passed.
- Dependencies were already installed in this checkout. No service, browser, authentication or seed was needed; no external process was started.

Disposition of driver frictions and expectations:

- Omitted-sender normalization, readback and absence of the fixture diagnostic: verified here; all required claims held.
- Missing setup handoff: recorded this encounter under the existing idea [[projects/mlegls-pi/issues/supervised-study-drive-lacks-setup-handoff]]. The README/ticket workaround sufficed for this CLI journey.
- Non-green root check: Obsidian errors remain owned by [[projects/mlegls-pi/issues/root-typecheck-obsidian-environment]]; newly observed memory errors filed separately as [[projects/mlegls-pi/issues/root-typecheck-memory-diagnostics]]. Neither is an acceptance requirement of this fixture repair. No diagnostic was hidden or ignored by a changed compiler configuration.
