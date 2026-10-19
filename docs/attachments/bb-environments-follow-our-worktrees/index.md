# Worker environments: implementation first use

Base: `0fd64560f3758365ae137ffc943557643eb52161`. Nonvisual CLI/library change; no screenshots. Independent story acceptance follows this implementation handoff.

## Prepared target and entry points

- Local BB daemon on `host_w74xscm3fz`, existing operator CLI authentication; no secrets or additional services needed. Worker checkout: `bb-environments-follow-our-worktrees-implement-2`; setup completed with `mise run setup` before implementation.
- Exercise spawn/retirement without launching model sessions: `bun test lib/thread/runtime.test.ts lib/thread/lifecycle.test.ts lib/dispatch.test.ts` (existing fake-BB fixture, isolated temporary git repositories).
- Inspect the live sweep surface safely: `bun docs/attachments/bb-environments-follow-our-worktrees/sweep.ts`. This command was opened with `--apply` for the authorized one-off sweep; omit that flag for read-only use. It checks only this BB thread's host, across all projects, with paginated selection and a fresh path-existence check before each deletion.
- Real metadata surface tried: `bb environment show env_8zg7gb5596 --json`. Updating this worker's environment from its recorded `ab-parent` produced `mergeBaseBranch: tree/retire-the-ab-thread-registry`. `bb environment diff-files env_8zg7gb5596 --target branch_committed --merge-base-branch tree/retire-the-ab-thread-registry --json` returned available with merge base equal to the base above.

## Observations

1. Before sweeping, checked `env_essmuz7d8u` (project-checkout attachment, unmanaged) whose `/Users/mlegls/dev/mlegls-pi__worktrees/bb-spike-1` folder was absent. Its two archived threads were `thr_dmdgsqbv9e` and `thr_ufgqffjnxw`. `bb environment delete env_essmuz7d8u --json` returned `{ok:true}` without a missing-folder error. Cleanup is asynchronous: it initially reported teardown/running and then destroyed/removed with path null. Both threads remained readable, `deletedAt: null`, archived; the first thread's 71-event log remained readable. No thread deletion command was used.
2. Initial cross-project inventory: 1,124 ready rows, 1,102 absent paths. The main sweep requested 1,098 deletions; four selected IDs had already disappeared (HTTP 404), confirmed absent afterward: `env_5fw36f5w9p`, `env_wmx9jdzhzz`, `env_y39m98q4dh`, `env_ri7b9pe4yi`. The replay script treats this concurrent-disappearance case as already gone. A final pass found and deleted two additional absent-path rows created by concurrent worktree retirement.
3. Final observed total: **1,101 environments destroyed** by probe + sweep + final pass (1 + 1,098 + 2). Destroyed rows updated since the probe agree: `proj_xzgxqiaesb` 137, `proj_fgz6kudzrk` 843, `proj_6agvjc7b6a` 1, `proj_th76eh3wkx` 66, `proj_azpfnwqamm` 54. The four already-absent IDs are not counted as our deletions. Final inventory: 21 ready environments, **zero absent paths**.
4. Spawn now sets BB environment merge-base metadata from branch `ab-parent`. Retirement requests environment deletion only for an owning thread after its worktree is absent and its BB thread archived; guest retirement does not delete the shared environment. Metadata-update failure stops/archives the newly created BB thread before spawn cleanup.

## Checks

- Existing affected tests: 22 passed, 117 assertions across the three entry-point files above, both initial and final runs.
- One intermediate rerun timed out in `archive conflict answered turn-end is not a resolution: node and ancestor stay active` at the default 5,000ms limit. Rerun unchanged passed all 22; no timeout/expectation was weakened.
- `bunx tsc --noEmit`: passed after the final affected-test run.

No dev servers, browser pages, containers or tunnels were started.
