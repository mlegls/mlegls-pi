# Obsidian tracker typecheck: first use

Tested revision: `158cda6e`. Surface: CLI at the verifier worktree root, no authentication.

## Prediction before use

Following the README’s Development instructions, I’ll run `bun run setup` and expect both locked installs to finish successfully. Then I’ll run `bun run typecheck` and expect exit 0 with no TypeScript diagnostics, including for the Obsidian tracker.

## Encounter

1. `bun run setup` exited 0. Bun 1.4.5 completed the frozen-lockfile checks for the root and `extensions/obsidian-tracker/`; dependencies were already present and neither install made changes. Setup readiness: met.
2. `bun run typecheck` invoked `tsc --noEmit` and exited 0 after 25 seconds. TypeScript diagnostics: 0. Prediction and ticket criterion: met.

No friction observed. This run verified the documented setup and check with dependencies already present in the verifier worktree; it did not measure a cold install.

## Replay check

From the repository root, run `bun run setup` and wait for both locked installs to exit successfully. Then run `bun run typecheck`. Accept exit 0 and no TypeScript diagnostics.

## Review (cold nested install)

Revision `511358f4`. With `extensions/obsidian-tracker/node_modules` moved aside, `tsc --noEmit` reported exactly 57 `error TS` diagnostics, the audit's count. `bun run setup` then installed `obsidian@1.13.1` (11 packages), and `bun run typecheck` exited 0 with 0 diagnostics in ~20 s. The README Development line names the step that was missing.
