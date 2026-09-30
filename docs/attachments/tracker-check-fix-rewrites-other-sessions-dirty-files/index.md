# Scoped tracker archive repairs — first-use drive

## Predictions (recorded before CLI use)

From the ticket and checkout-local tracker documentation:

1. After moving two done issues to `archive/`, I can pass both archived paths to `check --fix`. Links to those issues should update even inside a file with another user's uncommitted prose. An unrelated stale archive link in that file and in a separate dirty file should remain byte-for-byte unchanged.
2. The archive instructions should tell me to pass the moved archived paths; they do (vault adapter, archive layout and `check` paragraph).
3. Relative and absolute archived paths should both select the intended targets. Findings outside that selection should remain reported and can keep the command nonzero.
4. A subsequent plain `check` should report remaining repairs without writing. An unscoped `check --fix` should still repair all stale links.

## Setup plan

Tested product revision: `0c558733c77c68e8b6981742b611a6723e409dd7`.
The implementer's setup handoff was null. The README says workmux installs checkout-owned dependencies; the tracker docs provide the direct Bun CLI and skill-owned lockfile. Use this checkout's tracker entry point, not the ambient skill symlink (which points to the canonical checkout).

Deployment: local CLI, no service or authentication. Owned target: a disposable Git tracker under this worktree's `.wm/`, with its own HOME/vault symlink and authored Markdown seed. No existing tracker/vault data will be changed. The seed will contain two moved done issues, one unrelated archived issue and two dirty live issue files. Only the documented CLI is used; no implementation, tests or preexisting fixtures are inspected.

## Session log

- Read the ticket, README, verification packet contract, and checkout-local tracker skill/adapter. The ambient tracker adapter is older and lacks the scoped command; switched to the checkout-local skill before driving.

- Setup finished: checkout-owned dependencies needed no changes. The isolated vault resolves all five intended stale-link occurrences; first `check` reports the three target identities and exits 1. Both live files have uncommitted prose and both moved issues are uncommitted archive moves.
- Ran `check --fix docs/issues/archive/move-a.md <absolute-path-to-move-b.md>`. Exit 1. All A/B body links (including A's alias) now point to archive; both unrelated `older` links remain reported. The unrelated dirty file is byte-identical; the mixed file retains the user's paragraph and its unrelated link unchanged.
- Ran read-only `check`: only the unrelated repairs remain; both files byte-identical to the preceding state. Ran unscoped `check --fix`: both remaining links repaired, exit 0, final `check` says `ok`.

### Follow-up expectation before use

The docs explicitly say that *both* scoped and unscoped forms drop all `blocked-by` links to done issues. That appears broader than the ticket's “only links whose targets moved” language. I will add an unrelated, still-live done prerequisite to a separate dirty file, then repeat the same selected archive repair. I expect the documented global blocker cleanup to occur, but that would leave the motivating dirty-file safety promise incomplete. Acceptable strict ticket outcome: the unrelated blocker/file is unchanged; acceptable documented outcome: the blocker is removed. Record these separately rather than silently treating them as equivalent.

- Follow-up: with the selected archive links already repaired, added a new dirty ticket with `blocked-by: ["[[projects/scoped-drive/issues/unrelated-done]]"]`, targeting an unrelated live done issue. Repeated `check --fix docs/issues/archive/move-a.md`. Exit 0, `fixed blocked-dirty: removed done blocked-by unrelated-done`; the unrelated file was rewritten. This meets the documentation's explicit cleanup description but not the ticket's strict target-only rewrite promise.
- Tried a nonexistent archived path. Exit 1 names the nonexistent path, but emits an uncaught exception with source excerpt and stack rather than a compact CLI error. No implementation was inspected; this excerpt came from the command's public error output. Captured as [a tracker CLI friction](../../issues/tracker-invalid-moved-path-emits-uncaught-exception.md).

## Outcomes

| Story | Outcome | Evidence |
|---|---|---|
| Limit writes to links whose targets moved in this change | **held after review repair** (driver: failed): archive-link repairs are scoped correctly, including relative/absolute arguments and aliases; unrelated done blockers are still removed from unrelated dirty files | [scoped output](02-scoped.txt), [dirty-file diff](03-dirty-diff.txt), [blocker output](06-unrelated-blocker.txt), [blocker diff](07-unrelated-blocker-diff.txt) |
| Tracker skill archive instructions use the scoped command | **held**: checkout-local vault adapter's archive layout names the command and requires each archived path; the `check` paragraph documents relative/absolute paths and remaining diagnostics | `skills/enabled/all/mlegls/conventions/tracker/references/issue-tracker-vault.md` |

Nonvisual CLI drive; no screenshots. No server, browser, remote deployment or process was started. All disposable state is inside this worktree.

## Expectations

- **Met:** selected A/B body links update, aliases survive, uncommitted prose survives; unrelated stale archive links stay unchanged, and the unrelated dirty body-only file stays byte-identical.
- **Met:** relative and absolute target paths work together; unrelated repairs remain visible and exit 1 despite successful selected fixes.
- **Met:** plain `check` does not write; unscoped `check --fix` repairs the remaining stale links and final `check` reports `ok`.
- **Met:** the archive instructions use the scoped form.
- **Not met (ticket safety expectation):** a dirty file with an unrelated done prerequisite should not change when no links target the selected moved issue. It loses its `blocked-by` field.
- **Met (documentation prediction):** even scoped fixing removes unrelated done blockers. This is the limitation that contradicts the stricter ticket promise, not an undocumented surprise.
- **Not met (formed on invalid input):** a nonexistent target should produce a concise actionable error; instead it dumps an exception/source excerpt/stack. The path and reason are still clear.

## Frictions

1. Null setup handoff required reconstructing the entry point and ownership from README/skill docs. No inaccessible target was assumed.
2. Ambient tracker skill resolves to canonical checkout with older docs. Using the checkout-local skill/CLI avoids testing the wrong version.
3. Scoped success exits 1 when unrelated findings remain. Documented, but shell `&&` chaining would stop after a successful selected repair; inspect the diagnostics before treating it as failure.
4. Global done-blocker removal still writes another user's unrelated dirty file. The scoped command cannot yet satisfy the ticket's full target-only write promise.
5. Invalid target emits an uncaught stack trace: [durable friction issue](../../issues/tracker-invalid-moved-path-emits-uncaught-exception.md).

## Replayable checks

Start from a fresh checkout-owned scratch target with `bash docs/attachments/tracker-check-fix-rewrites-other-sessions-dirty-files/setup.sh`. It creates `.wm/tracker-scoped-drive`; remove **only that disposable directory** before replaying. Set:

```bash
ROOT=$(git rev-parse --show-toplevel)
CLI="$ROOT/skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"
STATE="$ROOT/.wm/tracker-scoped-drive"
cd "$STATE/scoped-drive"
export HOME="$STATE/home"
```

1. `bun "$CLI" check`: accept exit 1 and available archive repairs for `move-a`, `move-b`, `older`; hash the two dirty files before and after and accept unchanged bytes.
2. Save both dirty files; run `bun "$CLI" check --fix docs/issues/archive/move-a.md "$PWD/docs/issues/archive/move-b.md"`. Accept exit 1; A/B links get `/archive/`, the alias remains `|A`, both `older` links and all user prose remain unchanged; `other-session.md` must be byte-identical. The observed command passes this check.
3. Save the resulting dirty files; run plain `check`. Accept only `older` findings, exit 1, unchanged bytes.
4. Run unscoped `check --fix`. Accept both `older` links changing to `/archive/`, exit 0, and final `check` printing `ok`.
5. Add `unrelated-done.md` with `stage: done`, `author: user:drive`; add `blocked-dirty.md` with `stage: ticket`, `assignee: agent`, `author: user:drive`, and the exact quoted `blocked-by` relation shown in [the diff](07-unrelated-blocker-diff.txt), plus the user's paragraph. Save it. Run `check --fix docs/issues/archive/move-a.md`. For the strict ticket promise accept **unchanged bytes** and no unrelated blocker removal. Observed result fails: the blocker field is deleted, while prose survives.
6. Run `check --fix docs/issues/archive/does-not-exist.md`. Accept nonzero with an actionable missing-path diagnostic and no writes. Compact diagnostic quality remains unmet; [actual output](08-invalid-target.txt).

## Evidence files

- [Setup recipe](setup.sh): authored disposable Markdown state, not a product test or preexisting fixture.
- [Before](01-before.txt), [scoped](02-scoped.txt), [dirty diff](03-dirty-diff.txt), [read-only after](04-after.txt), [unscoped](05-unscoped.txt).
- [Unrelated blocker removal](06-unrelated-blocker.txt), [its file diff](07-unrelated-blocker-diff.txt), [invalid path diagnostic](08-invalid-target.txt).

## Review (appended after the driver's log)

The driver's failure was real: `check --fix <paths>` still ran the global done-`blocked-by` cleanup, rewriting unrelated dirty files. Repair in `issues.ts`: with moved paths, only `blocked-by` links whose target is one of those files are dropped; other done blockers are reported (`... remove it (check --fix without moved issue paths)`) and left alone. The adapter doc states this.

Re-drove checks 2 and 5 on the repaired head from a fresh `setup.sh` state: scoped fix of both moved paths repaired only A/B links in `mixed.md`; `older` links stayed reported and unchanged; a new dirty `blocked-dirty.md` with a blocker on an unrelated done issue stayed byte-identical (`cmp`); exit 1 with remaining findings; unscoped `check --fix` then removed the blocker, repaired `older`, exit 0, `check` printed `ok`. Story 1 now **held**.

Retained as an automated test: `check --fix <moved paths> repairs only links and blockers targeting the moved issues` in `skills/enabled/all/mlegls/conventions/tracker/scripts/issues.test.ts` (checks 2 and 5; the defect that happened). Checks 1, 3, 4 (read-only `check`, unscoped fix) are already covered by existing tests. Check 6 stays a filed friction: [tracker-invalid-moved-path-emits-uncaught-exception](../../issues/tracker-invalid-moved-path-emits-uncaught-exception.md); the CLI throws uncaught `Error`s for all argument errors, so a concise-error change belongs to that issue, not here.
