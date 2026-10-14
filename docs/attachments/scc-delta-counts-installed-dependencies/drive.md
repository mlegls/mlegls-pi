# Independent CLI encounter

Tested revision: `9246a8a89c7d4ecfcddc81f1219d2b8150057027`.

## Predictions before use

- Historical story: running the documented reproduction with installed nested dependencies should show directory deltas +16 code / +4 complexity, matching the three-file delta, not dependency-sized growth. It should identify the dependency paths responsible for the old inflated totals.
- Selection story: through the helper CLI, tracked source and untracked-not-ignored source should count on the appropriate side; ignored nested dependencies and another ignored directory should not. A filename containing spaces should work. An empty selection should report zero.

## Setup

Local CLI in this worker-owned checkout; no authentication or service. Worktree setup was reported finished by the parent. Entry: `mise exec ubi:boyter/scc@3.7.0 -- bash docs/attachments/scc-delta-counts-installed-dependencies/reproduce.sh`. Documentation states that the reproduction owns a temporary historical checkout, installs dependencies and cleans up on exit. No inherited deployment selectors are used.

## Encounter

### Historical reproduction — held

Ran the documented entry point after recording predictions. It finished successfully in approximately three seconds. Directory code was 8,747 → 8,763 (+16); complexity 2,339 → 2,343 (+4). Three-file code was 687 → 703 (+16); complexity 281 → 285 (+4). The original unfiltered directory walk reported 1,626,597 code and 83,571 complexity, reproducing the ticket's inflated current totals. The output identified 525 ignored files under `lib/outline-read/node_modules` and 234 under tracker `scripts/node_modules`. Prediction met.

### Git-selected CLI use — held

Created an owned temporary Git repository (not a repository test), with `.gitignore` entries `node_modules/` and `ignored/`, and a committed `src/tracked.ts` containing `const tracked = 1;`. Recorded its commit as the baseline. Added untracked `src/new file.ts` containing `const fresh = 2;`, ignored `src/pkg/node_modules/dep.ts` containing `const dependency = 3;`, and ignored `src/ignored/hidden.ts` containing `const hidden = 4;`.

Invoked this checkout's helper using `bash "$helper" "$base" src`, under `mise exec ubi:boyter/scc@3.7.0`. Observed code 1 → 2 (+1), complexity 0 → 0 (0). Invoked from `src` using path `.`: identical totals. Invoked with path `missing`: zero totals on both sides. Thus tracked baseline/current source and the untracked space-containing filename counted, while both ignored paths did not. Prediction met. The temporary repository was removed by the command's exit trap.

## Replayable checks

1. Run the documented historical entry point at the tested revision. Accept matching directory and three-file deltas (+16/+4), with old unfiltered totals 1,626,597/83,571 and the two dependency roots listed above.
2. Recreate the temporary repository exactly as described, committing only the ignore file and tracked source before adding the other three source files. Run the helper against that commit with `src`. Accept code 1 → 2 and complexity 0 → 0; a current total of 3 or 4 would show ignored-source leakage.
3. From that repository's `src`, repeat with `.`. Accept the same totals. Repeat with `missing`; accept 0 → 0 for both metrics.

## Frictions, limits and cleanup

No user-facing friction encountered. Both expectations were met. No rendered UI was involved; screenshots are not applicable. This encounter establishes the public CLI behavior, not its internal file-list implementation (intentionally not inspected). Both processes exited successfully; their owned temporary targets were cleaned on exit. No servers, browser pages, tunnels or deployments were started.
