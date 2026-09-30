# Joined CLI acceptance

## Before first use

Revision: `f3b6c2e` (all four children integrated). Only joined acceptance remains; no implementation changes are planned.

Predictions:
- Use `ab edit`'s sigiled block header to author tracker links in a dirty note. The legacy spelling still works; stale anchors reject without writing.
- A scoped tracker fix repairs the selected archived link, preserves an escaped table alias, and leaves matching inline/fenced examples and unrelated dirty links/blockers unchanged. Remaining findings keep exit 1; unscoped fixing then clears live findings without rewriting examples.
- In an isolated mailbox, definitely absent/stopped subscribers give exit 1 but retain posts; unknown subscribers warn with exit 0; recognized live subscribers give exit 0. IDs do not certify consumption.
- Existing outline-read, board mail and tracker regressions pass together on the joined revision.

## Setup

Local CLIs from this checkout, not ambient `ab`/tracker symlinks. No remote deployment or authentication. Persona: local tracker author and synthetic offline Pi recipients. Tracker seed uses the existing [scoped setup recipe](../tracker-check-fix-rewrites-other-sessions-dirty-files/setup.sh) in `.wm/tracker-scoped-drive`, with its own HOME/vault. Anchor and mail state are separately isolated under this worktree's `.wm/`. Recipients load only this checkout's `lib/session-meta/host.ts`, plus `lib/board/host.ts` when subscribed.

Preparation: `bun run setup`. Product entry points: `bun ab/main.ts read|edit|mail` and `HOME="$STATE/home" bun "$ROOT/skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts" check --fix docs/issues/archive/move-a.md` from the seeded tracker directory. Mail recipient launch/readiness follows the [child's committed recipe](../make-undeliverable-mail-status-visible-to-scripts/index.md#independent-cli-encounter).

Preparation succeeded (`bun run setup`, all four installs unchanged). Both Pi recipients returned successful `get_state` responses before mailing. All four mail posts were visible in isolated stats.

## Outcomes

| Claim | Outcome | Evidence |
| --- | --- | --- |
| Sigiled block authoring, legacy spelling and stale-anchor safety | held | [Edit/tracker log](edit-tracker.txt): exit 0 for both spellings; reused anchors exit 2 with unchanged bytes |
| Scoped fixing with code masking and escaped table alias | held | Same log: selected live links repaired; exact expected document bytes; inline/fenced examples, unrelated dirty links/blocker and prose unchanged; remaining findings exit 1 |
| Unscoped fixing still clears live repairs without rewriting examples | held | Same log: remaining archive links/blocker repaired; code suffix unchanged; final `check` exit 0, `ok` |
| Absent/stopped, unknown and live mail statuses | held | [Mail log](mail.txt): exits 1/0/0/1 with appropriate warnings; all four sends remain recorded |
| Joined existing regressions | held | [Regression result](regressions.txt): 76 passed across 8 files |

All predictions met. No new friction, implementation repair or permanent acceptance test. The children's reviewed evidence covers their individual contracts; this packet adds the joined encounter and regressions.

## Replay

From a fresh checkout, prepare dependencies with `bun run setup`, then run `bash docs/attachments/small-ab-cli-fixes/setup.sh`. This committed seed recipe lands directly on the dirty note through checkout-local `ab read`. It refuses to reuse an existing tracker fixture. No authentication or external service is needed.

Use the same isolated anchor paths for subsequent reads/edits:

```sh
ROOT=$(git rev-parse --show-toplevel)
STATE="$ROOT/.wm/tracker-scoped-drive"
TARGET="$STATE/scoped-drive"
CLI="$ROOT/skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"
export AB_STATE="$ROOT/.wm/joined-state/ab"
export AB_SESSION_STATE="$ROOT/.wm/joined-state/session"
```

1. From the seeded read, copy fresh anchors for `Selected alias:` and `Selected B:`. Submit `=ALIAS =B` to `bun ab/main.ts edit`, with these two body lines:

   ```text
   | Selected table alias | [[projects/scoped-drive/issues/move-a\|A]] |
   Selected B: [[projects/scoped-drive/issues/move-b]].
   ```

   Expect exit 0, only that range changed. Save the file and retry the same old header with a different body; expect nonzero and unchanged bytes. On a separate five-line file (`before`, `old one`, `old two`, `old three`, `after`), read fresh anchors and replace lines 2–4 with `=SECOND FOURTH`; expect the legacy spelling to work.
2. Save `mixed.md` and `other-session.md`. From `$TARGET`, run `HOME="$STATE/home" bun "$CLI" check`; expect archive/blocker findings but no findings for missing code examples and no writes. Then run `HOME="$STATE/home" bun "$CLI" check --fix docs/issues/archive/move-a.md "$TARGET/docs/issues/archive/move-b.md"`. Expect exit 1: only the A/B live links acquire `/archive/`, the escaped pipe remains, and unrelated `older` links/blocker and code examples are byte-identical. The separate dirty file must be entirely unchanged.
3. Run unscoped `HOME="$STATE/home" bun "$CLI" check --fix`, then `check`; expect exit 0, live `older` links/blocker repaired, examples unchanged, final `ok`.
4. For mail, follow the [isolated environment and recipient launch recipe](../make-undeliverable-mail-status-visible-to-scripts/index.md#independent-cli-encounter), using a fresh `.wm/joined-mail-state` directory in this checkout. Remove inherited session/workmux selectors as documented there. `mail --stats` must initially be empty. Send to `ticket/joined-acceptance/absent` (exit 1); launch metadata-only Pi and mail the last eight characters of its ready session ID (exit 0, unknown warning); stop/await it. Launch metadata+board Pi, wait for readiness and mail its mailbox (exit 0, no warning); stop/await it and resend (exit 1). Final stats must contain one ticket post and three mailbox posts. Capture stdout, stderr and status separately, as in [mail.txt](mail.txt).
5. Existing regressions: `ab check -- bun-axi test lib/outline-read lib/board/mail-drive.test.ts skills/enabled/all/mlegls/conventions/tracker/scripts/issues.test.ts` (76 passed here).

## Cleanup and limits

All owned Pi processes stopped and awaited; isolated mail state removed. Tracker and anchor scratch are removed after the final seed-readiness trial. No browser, server, container, tunnel, remote deployment or shared daemon was started or restarted. CLI-only evidence (`visual: false`, `shots: []`). Unknown mail subscriptions were exercised through a live metadata-only session, not a daemon restart; recognition is not evidence of consumption, neither of which the contract requires.

## Independent first-use drive

Retested `4a1e90c` through checkout-local CLI surfaces, without reading product source/tests. All four behavior stories held, including unrelated done-blocker preservation, live-link diagnostics next to ignored examples, and escaped table aliases. Existing joined regressions: **76 passed across 8 files**. [Predictions, encounters, frictions and replayable checks](drive.md), with [setup](drive-setup.txt), [anchor edits](drive-edit.txt), [tracker](drive-tracker.txt), [mail](drive-mail.txt) and [regression result](drive-regressions.txt). CLI-only (`visual: false`, `shots: []`); test assertion adequacy remains for reviewer inspection. The drive log records setup recovery and owner-tracker friction links.

## Review

Read the four children's diffs and tests against the driver's log; 76 existing regressions pass (`ab check -- bun-axi test …`, same command as above).

- **Defect found and repaired:** `maskMarkdownCode` closed an inline code span at any later matching backtick run, across blank lines. A note with a stray `` ` `` in one paragraph and an unrelated code span paragraphs later reported `ok` while a broken `[[projects/fx/issues/nope]]` sat between them (reproduced before the fix). Code spans now close only within their paragraph. Retained as a scenario in `issues.test.ts` ("check still reports a broken link between an unmatched backtick and a later code span"); tracker suite 21 passed.
- **Test adequacy:** the children's tests assert user-visible CLI results: exit codes and stderr for mail (absent, unknown, wrong-board, exited), exact file bytes and `fixed` lines for scoped tracker repair, code masking and escaped-pipe aliases, and parser/edit results for `=a =b`. They cover driver checks 1–4; the driver's rollout-example and outside-checkout-mail launch checks stay as evidence only (they guard this ticket's docs and a Pi launcher issue, not a later regression).
- Driver frictions each already have an owner issue; nothing further filed.
- Behaviors stories re-held on the final head: the only behavioral change is the paragraph bound on code spans, covered by the new test and the existing code-example tests.
