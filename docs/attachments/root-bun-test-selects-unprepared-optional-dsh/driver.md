# First-use CLI drive — 2026-09-30

## Before first use

Tested revision: `70be7498d7ecfecc20c65497baf2de5cb1b14f65`, Bun 1.4.2.
Owned target: local checkout on branch `root-bun-test-selects-unprepared-optional-dsh-drive`, at `/Users/mlegls/dev/mlegls-pi__worktrees/root-bun-test-selects-unprepared-optional-dsh-drive`. No server, account/authentication or seed is required. The handoff names the implementer's checkout; this drive recreates setup in the driver's own checkout rather than using that target.

Initial observation: root `node_modules` exists; `dsh/node_modules` does not. No optional dependencies will be installed to make root discovery pass.

### Predictions (recorded before setup/test commands)

1. **Root discovery without optional preparation.** After `bun run setup`, `bun test` will execute the ordinary root suite without selecting `dsh/` tests or complaining about unresolved `@deepseek-ai/dsh-session` / `@deepseek-ai/dsh-tools`. Root setup will leave `dsh/node_modules` absent. The contract is exclusion, not a wholly green unrelated suite.
2. **Setup documentation explains the boundary.** As a root developer, I can follow README's `bun run setup`, then `bun test` without optional dsh work. Both root README and dsh README will make optional setup explicit and give `bun run --cwd dsh setup`, followed by `bun test --cwd dsh` for optional-package development.

Documentation observation before commands: root README Development gives exactly those commands, explains independent checkout dependencies, and says root setup does not install dsh. dsh README independently describes it as an optional, independent package, repeats that exclusion and gives both setup commands before its separate test command. Prediction 2 is met as a documentation encounter; optional package setup/build/test functionality has not been exercised.

## Session log

- `bun run setup` (through `ab check`) completed with exit 0. Full CLI receipt: [driver-setup.log](driver-setup.log).
- After root setup, `dsh/node_modules` is absent.

## Replayable checks

- In a checkout with no `dsh/node_modules`, run `bun run setup`, wait for exit 0, and check that `dsh/node_modules` is still absent. Then run `bun test` to completion and retain the discovered test-file list and diagnostic output. Accept no selected path beginning `dsh/` and no unresolved `@deepseek-ai/dsh-session` or `@deepseek-ai/dsh-tools` import. Other suite failures must be recorded separately, not hidden by optional setup.
- Read the root README's Development section and dsh README's opening setup section. Accept an explicit optional/independent boundary, root discovery exclusion, and executable separate commands `bun run --cwd dsh setup` and `bun test --cwd dsh`; neither should imply dsh preparation is required for root testing.

## Scope and resources

Only public setup/test CLI commands and user documentation were used; no source, diffs, test bodies or fixtures were read. The test runner's diagnostic output is part of the CLI encounter. No browser, server, container, tunnel or remote deployment was started. Optional dsh package-local setup/tests and model/Web journeys are outside the root-discovery contract and were not driven.
