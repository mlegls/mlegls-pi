# Successor refresh output and failed checkout cleanup

Implementation first use (2026-10-14); this is not independent acceptance.

## Runnable setup

Use a checkout containing this change, with `mise run setup` complete. No credentials, external deployment or product persona is required: these are local shell/git fixtures. Entry point:

```sh
bun test lib/reconcile/refresh.test.ts lib/thread/runtime.test.ts lib/thread/lifecycle.test.ts
```

Fixtures create disposable repositories and isolated state beneath `/tmp`, then remove their worktrees and stop their shell workers. Do not reuse a production collector to reproduce failure.

## Observed

- 13 tests passed, 0 failed, 77 assertions (42.60 seconds).
- The authorized output regression enabled `merge.stat=true` in its disposable repository; the real git trace included `merge --no-edit --no-verify --no-stat`. Refresh returned no conflicts and `git show` through the reconciler helper returned a complete 2 MiB blob.
- Existing successor regression retained predecessor work and collector decisions before setup/launch.
- `bun run typecheck` passed.
- A temporary first-use experiment created a repository containing `.gitattributes` with `*.bad filter=fail` and a tracked `payload.bad`. After committing, it set `filter.fail.smudge=false` and `filter.fail.required=true`, then called `newThread({cwd: repo, worktree: "failed", launch: {cmd: "sleep 300"}})`. Git checkout failed at the required smudge filter before launch; the error reported `Partial resources cleaned`. The experiment checked that the branch, path and worktree registration were all absent.
- The same experiment created an existing branch, attempted to create a same-named owning thread, and checked that the rejection left the pre-existing branch intact.

All temporary experiment repositories/state were removed. No server, browser or external deployment was started.

## Limits

The regression asserts merge arguments rather than constructing a diffstat above 1 MiB; separately it exercises actual output above the former buffer limit. The helper now has a finite 64 MiB limit, not unlimited output capacity.
