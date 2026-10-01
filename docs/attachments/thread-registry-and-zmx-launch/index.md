# Independent drive

Tested `692b5df86302ea1547f6f4c1621cda0eb7044479` through this worktree's freshly allocated disposable fixture. [Predictions, encounter, expectations, frictions and replayable checks](driver-log.md); [selected joins](driver-observations.json); [literal-send sequence](driver-literal.txt).

Owning/guest/no-setup, fork identity/reporting, both trees and labels, same-id restart with one bootstrap, live external promotion handover, literal send with explicit CR, current-session switching and headless CLI attach/detach held. Repeated aux ensure was not exposed by the fixture guide and remains for the ticket reviewer (check C6). Fork subscriptions retained parent thread/mail topics despite correct reporting; [captured separately](../../issues/forked-thread-retains-parent-board-subscriptions.md). [Fixture help/PTY friction](../../issues/thread-fixture-help-and-headless-pty-entry.md).

Regression rerun: 167 passed, 2 skipped. Typecheck passed after the existing frozen Obsidian plugin install workaround. Fixture cleanup returned no terminals or active threads; its root and all owned PTY processes were removed. Nonvisual library/CLI evidence; no browser or native UI encounter.

---

# Thread registry / zmx launch first use

Registry and launch loop implemented. This is implementer first use through the library and zmx, not independent acceptance or a sidebar encounter. Starting ref: `b7eeaced`; tested source: `da956d5`. Installed pi 0.99.1, Bun 1.4.2, zmx 0.8.1.

## Setup for the driver

From the changed checkout:

```sh
mise run setup
mise exec -- bun docs/attachments/thread-registry-and-zmx-launch/fixture.ts prepare
```

That command was opened successfully. It creates an owned temporary git project with a declared setup marker, another without setup, isolated XDG state/board/zmx directories, and an isolated pi agent directory loading this checkout. Authentication is the existing normal pi persona's `auth.json` through a temporary symlink, or inherited provider credentials. No GUI or additional login is needed.

Preparation waits for canonical, forked and promoted pi to reach idle, then prints the root, ids and a directly runnable inspection command. [Observed ids and joins](observations.json) name the prepared target `/private/tmp/ab-thread-fixture-FFQJBN`. That target, all its terminals/worktrees, and its auth link were removed after use; rerun preparation rather than relying on that deleted state.

Use the printed root and ids:

```sh
bun docs/attachments/thread-registry-and-zmx-launch/fixture.ts inspect "$ROOT"
bun docs/attachments/thread-registry-and-zmx-launch/fixture.ts attach "$ROOT" "$CANONICAL_ID"
bun docs/attachments/thread-registry-and-zmx-launch/fixture.ts send "$ROOT" "$OWNER_ID" 'literal $HOME ; '\''quotes'\'''
bun docs/attachments/thread-registry-and-zmx-launch/fixture.ts history "$ROOT" "$OWNER_ID" 8
bun docs/attachments/thread-registry-and-zmx-launch/fixture.ts send "$ROOT" "$OWNER_ID" $'\r'
bun docs/attachments/thread-registry-and-zmx-launch/fixture.ts cleanup "$ROOT"
```

`external "$ROOT"` opens a free pi in a second terminal; `inspect` shows its exact live id. `promote "$ROOT" "$SESSION_ID"` registers it while live. Exit that free pi to observe the runner resume it. `switch "$ROOT" "$CANONICAL_ID"` prepares an empty replacement through `setCurrentSession`; send Ctrl-D to the agent to observe its next launch follow the new file. The actual in-pi session-switch hook belongs to the CLI/workspace ticket.

## Observations

- Owning new ran setup once (`setup-marker` contained one line); guest in main and guest in that worktree did not claim ownership. The no-setup project started normally. Aux `.server` was reused and all terminals had exact names and thread/role labels.
- Fork copied a persisted session once into its destination. Spawn ordering had owner → canonical guest → worktree guest → fork at depths 0–3. Merge ordering placed fork under the owning `owner` branch, not its guest; `ab-parent` was `owner`.
- Ctrl-D changed canonical pi pid 55655 → 60673 with the exact same id/file and one user message. Its bootstrap reply was `bootstrap-ok`.
- Empty external pi 54854 initially had no persisted file. Promotion left it as the sole live writer; after exit, pi 60623 resumed the same id as a guest.
- Moving the current session retained thread id `8e86c8e0-446a-44c4-8f7d-58bf602f90ba`; its next pi launch used session `01a0f70f-f08c-75d1-9235-50544cb1d9a6`, pid 41827. Old session lookup no longer resolved membership.
- Literal send showed the draft without `SUBMITTED`; only a separate real CR produced `SUBMITTED:literal $HOME ; 'quotes'`.
- [Additional first-use output](edge-observations.txt): ambiguous bare worker handle rejected, explicit run resolved, historical-id promotion could not overwrite a moved thread, direct pi command override resumed its registered id, inherited zmx prefix did not change terminal names, and failed setup identified its id/path and cleaned the partial worktree.
- Cleanup readback was `terminals: []`, `activeThreads: []`; no fixture runner remained.

## Existing checks

`bun-axi test`: 167 passed, 2 skipped across 30 files. `bunx tsc --noEmit` and `git diff --check`: passed. Typecheck preparation used the existing [Obsidian dependency workaround](../../issues/root-setup-still-omits-obsidian-typecheck-dependencies.md). No new permanent acceptance tests.

Size delta from the starting ref: +554 net lines in `lib/thread/`, plus the five-line mise config and 142-line disposable setup entry. No new JS dependencies; zmx is the mise tool.

## Review

[Review section of the log](driver-log.md#review): repeat-ensure (C6) measured and held through the retained test `lib/thread/runtime.test.ts`, which also replays C1, C2, C5 and the ambiguous worker handle over shell fixtures. No product defect found.
