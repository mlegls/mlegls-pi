# Thread lifecycle first use

Implemented raw integration and post-order archive/abandon. A conflicting child alone received the resolution request; its fresh done resumed child → parent → main. A blocked child retained its resources and marker, while an earlier sibling stayed retired; retry after resolution skipped that sibling. Nested abandon kept both branches without merging. Guest archive/abandon preserved the shared checkout and an unrelated process.

Implementer first use, not independent acceptance. Lifecycle source: `ff01fe9`; starting ref: `830e0b5`. Normal pi 0.99.2 agents loaded this checkout, over zmx 0.8.1 with Bun 1.4.2. All fixture resources and temporary authentication links were removed afterward.

## Driver setup

From the changed checkout:

```sh
mise run setup
mise exec -- bun docs/attachments/thread-archive-and-abandon/fixture.ts prepare done
```

This command was opened successfully. It creates a checkout-owned temporary git project, isolated XDG state/board/zmx, and an isolated pi agent directory whose package selector is this checkout. Authentication uses the normal local pi persona's `auth.json` through a temporary symlink, or inherited provider credentials. Preparation waits for all six normal canonical agents to finish `done fixture-ready`; it then commits opposing child/parent values in `conflict.txt` and prints fixture ids and a directly runnable archive command.

Use the printed root; `parent`, `child`, `early`, `abandon`, `abandonChild` and `guest` resolve to its printed ids:

```sh
bun docs/attachments/thread-archive-and-abandon/fixture.ts archive "$ROOT" parent
bun docs/attachments/thread-archive-and-abandon/fixture.ts abandon "$ROOT" abandon keep
bun docs/attachments/thread-archive-and-abandon/fixture.ts archive "$ROOT" guest
bun docs/attachments/thread-archive-and-abandon/fixture.ts external "$ROOT"
bun docs/attachments/thread-archive-and-abandon/fixture.ts cleanup "$ROOT"
```

The fixture provides library entry points because CLI consumers land separately. `--help` lists inspection, raw integration, mailbox and history entry points. The `external` action promotes and archives a real canonical RPC pi outside zmx; its unrelated cwd peer must survive. Run cleanup even after a failed action.

For the blocked path, prepare a new fixture with `prepare blocked`, then:

```sh
bun docs/attachments/thread-archive-and-abandon/fixture.ts archive "$ROOT" parent
bun docs/attachments/thread-archive-and-abandon/fixture.ts inspect "$ROOT"
bun docs/attachments/thread-archive-and-abandon/fixture.ts resolve "$ROOT" child
bun docs/attachments/thread-archive-and-abandon/fixture.ts archive "$ROOT" parent
bun docs/attachments/thread-archive-and-abandon/fixture.ts abandon "$ROOT" guest
bun docs/attachments/thread-archive-and-abandon/fixture.ts cleanup "$ROOT"
```

Both preparation and these entry points were exercised. Recorded targets `/private/tmp/ab-lifecycle-JlhQjX` and `/private/tmp/ab-lifecycle-vTb4Io` are now deleted; regenerate them rather than reusing their selectors.

## Observations

- [Done walk and resource readbacks](done.json): before child done, main remained at the seed, parent/child remained active, and only the child carried the blocked marker. A deliberately fresh parent done did not resume the walk. After child done, cleanup returned early/child/parent in that order and deleted all three integrated branches/worktrees. The detached child-cwd process (pid 5918) appears in `killed` and was no longer alive.
- [Blocked walk, resolution and retry](blocked.json): the first cleanup returned only early as closed, with child's blocked marker persisted and returned. Parent/child terminals remained and main was unchanged. Manual child merge resolution followed by retry returned child/parent only, removed their branches and cleared the marker.
- [Done walk](done.json): nested abandon returned both kept branches; main HEAD did not move. Guest archive and [guest abandon](blocked.json) removed only their own terminals/pi, with no branch deletion and the unrelated cwd peer alive.
- [External pi readback](done.json): promoted canonical RPC pi pid 26447 was stopped despite being outside zmx; the unrelated cwd peer remained alive.
- [Temporary diagnostic output](diagnostic.txt): raw conflict captured `conflict.txt`, aborted to a clean child and emitted no board message. Synthetic reports from a wrong agent and the old canonical session did not complete archive after a current-session move; a fresh current-session done did. Explicit merge mode ran prepare and created a two-parent commit. These are temporary library probes, not real-agent acceptance or retained tests.
- Final fixture cleanup readbacks were `active: [], zmx: [], live: []`. No browser, GUI, server or deployment was started.

## Existing checks

`bun-axi test`: 169 passed, 2 skipped across 31 files. Relevant git/live/runtime subset: 8 passed. `bunx tsc --noEmit` and `git diff --check` passed. Typecheck used the existing [Obsidian setup workaround](../../issues/root-setup-still-omits-obsidian-typecheck-dependencies.md). Tracker semantic lint ran before and after the Result; its weak advisory suggestions cite the done prerequisite, required acceptance text and declared retirement danger, not an observed product failure or unowned friction.

Delta from the starting ref: +282 net library lines in three lifecycle files, with no new dependency or permanent acceptance test. The disposable driver setup is separate from product code.
