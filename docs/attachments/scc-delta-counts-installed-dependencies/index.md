# scc-delta: Git-selected source

Independent acceptance: [CLI encounter, predictions and replayable checks](drive.md).

Implementation first-use notes (not independent acceptance). Base: `a52c3e82d1987b71c13dedc6c81df55b94a9c249`.

## Runnable setup

Local CLI; no service, account, or secrets. From the committed worker checkout (or its integrated successor):

```sh
mise exec ubi:boyter/scc@3.7.0 -- bash docs/attachments/scc-delta-counts-installed-dependencies/reproduce.sh
```

Requires Git, Bun, jq and scc. The explicit mise selector uses the installed historical scc version without changing global tool configuration. The script creates an owned temporary detached checkout at `8b48b29f`, installs the existing nested packages, invokes this checkout's helper against `a5bb3a3`, and removes its checkout on exit. Each helper invocation also removes its baseline worktree. No existing checkout is seeded or modified. Both package installs completed successfully in first use.

## Observed historical reproduction

Scope: `lib` and `skills/enabled/all/mlegls/conventions/tracker/scripts`.

| Selection / walker | Code | Complexity |
| --- | --- | --- |
| Git-selected directories | 8,747 → 8,763 (+16) | 2,339 → 2,343 (+4) |
| Git-selected three changed TypeScript files | 687 → 703 (+16) | 281 → 285 (+4) |
| Original unfiltered current directory walk | 1,626,597 | 83,571 |

The three files are `lib/tracker-views.test.ts`, tracker `scripts/issues.test.ts`, and tracker `scripts/issues.ts`. The directory walk exactly reproduced the reported inflated current totals with scc 3.7.0. Git identified 525 ignored files under `lib/outline-read/node_modules` and 234 under tracker `scripts/node_modules`; these installed dependency trees entered the old directory walk. The corrected directory delta matches the per-file delta.

Also tried scc 4.1.0: both selections still give +16 code / +4 complexity; its different absolute complexity counts are version-dependent.

## Other direct first use

A temporary Git repository with a tracked one-line TypeScript file, an untracked one-line TypeScript file whose name contains a space, and ignored source under both nested `node_modules` and a separate ignored directory produced +1 code / +0 complexity. Invoking from the nested source directory gave the same result. An empty path selection produced zero totals on both sides. These were temporary diagnostics, not retained tests.

`bash -n` passed for the helper and reproduction script; `git diff --check` passed. There are no existing tests specifically covering this shell helper. No permanent tests were added.

The reproduction exposed an existing physical-versus-logical working-directory mismatch (`/private/var` versus `/var`). Separate fix `573cc303` uses Git's relative prefix rather than string subtraction; both historical and nested-directory first use then succeeded.
