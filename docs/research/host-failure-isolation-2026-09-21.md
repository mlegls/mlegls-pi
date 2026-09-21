# Host installation failure isolation — 2026-09-21

Starting ref: `e9f0be5341048bc8119f03c44fbe5990f15a92d3`.

## Change

Board, record, session, and session-meta are independent Pi extensions declared
in `package.json`, retaining their implementations in `lib/*/host.ts`. Each adds
a default factory export; the named `install` export remains for existing imports
and archived adapters. Exec no longer discovers or installs host modules.

Pi now owns the failure boundary, reporting, and registration cleanup. Host changes
and recovery still use `/reload`; live replacement is deliberately out of scope.

## Observed

- Pi’s real loader on both the project SDK (0.84.4) and installed SDK (0.85.1)
  loaded all nine manifest entrypoints without errors. Board, record, jump,
  workspace, and exec-reset were each registered once. Exec itself registered
  only computer-use and exec-reset commands.
- A temporary directory contained four extension factories: successful sync,
  failed sync, failed async, and successful async. Each registered a command,
  session hook, boolean flag default, provider, and event-bus subscription.
  Both SDK versions returned two successful extensions and two load errors.
  Only successful factories contributed commands, flag defaults, queued providers,
  and event-bus deliveries. Captured APIs from both failed factories rejected
  later registration attempts. Temporary fixtures were removed.
- `env -u BB_THREAD_ID pi --no-extensions -e . --list-models featherless`
  exited 0 and listed the catalogue through the installed Pi CLI. No model
  inference, desktop capture, or permission setup was requested.
- The existing Board delivery integration initially failed because its fixture
  loaded only exec. It now loads manifest-declared host entrypoints plus exec;
  behavioral assertions are unchanged. Its targeted suite passed (3 pass, 1 skip).
- Full existing suite: `env -u BB_THREAD_ID bun test` passed (203 pass,
  2 skipped, 0 failed; 205 tests across 32 files). The skips require concurrent
  workmux workers, which were not launched. Counts include concurrent anchor work.
- `bunx tsc --noEmit` and `git diff --check`: passed.
- Scoped `scc-delta.sh` against the starting ref, covering `extensions/exec` and
  the four host entrypoints: code 3,489 → 3,455 (-34), complexity 1,137 → 1,129 (-8).
  Scope excludes concurrent anchor work.

## Boundaries

This isolates Pi registrations after a factory fails, not arbitrary external
side effects or import-time work. Resources still belong in session lifecycle
hooks. No hot replacement or automatic retry was added. New host entrypoints
require a manifest entry. Loading exec alone with `-e` intentionally no longer
loads its host integrations. Interactive reload and human-facing commands that
write vault conclusions or change sessions were not driven.
