# Thread sidebar — implementation first use

Code: `3fef025` (base `590758db`). Earlier native and private-pty encounters used `3d082fc` and `13f561f`; the final re-drive covers the added zmx leader guard. This is an implementer's self-check, not independent acceptance.

## Setup and entry point

Local macOS Ghostty 1.3 development build with AppleScript dictionary, zmx 0.8.1 from mise, Bun, Git. Maintainer fixture, no model requests or credentials. `fixture.ts` registers this checkout as the isolated pi package; new/forked threads run actual pi, while the four seeded agents print their names and sleep. The seed is a guest root, owning child/grandchild and guest sibling in a disposable Git project.

```sh
mise exec -- bun docs/attachments/tree-sidebar-over-threads/fixture.ts prepare /tmp/owned-sidebar-drive
mise exec -- bun docs/attachments/tree-sidebar-over-threads/fixture.ts sidebar /tmp/owned-sidebar-drive
```

The second command opens the story's surface directly: a fresh, bound two-split Ghostty window. It was opened successfully for `/tmp/ab-thread-sidebar-m-first-use` and `/tmp/ab-thread-sidebar-m-redrive`; both targets and all owned windows/processes were removed afterward. `prepare` refuses an existing directory; `stop ROOT` checks checkout ownership and abandons only the isolated registry. Close the fixture window, accepting Ghostty's Close Window confirmation, then:

```sh
mise exec -- bun docs/attachments/tree-sidebar-over-threads/fixture.ts stop /tmp/owned-sidebar-drive
```

Do not run destructive actions against personal threads. No `/reload` of a canonical pi is needed to try this CLI. Root setup plus `bun install --frozen-lockfile --cwd extensions/obsidian-tracker` prepares the existing typecheck boundary.

## Encounters

- Both trees came from the registry. Tab switched spawn → merge; the owning child/grandchild remained linked in merge order while guest roots moved to depth zero. [Private-pty frames](pty-first-use.txt), section `06-merge`.
- Any-motion hover exposed all six actions plus abandon-all-children under the root. They wrapped at 40 columns. Wheel and j/k changed the viewport/selection without changing the main client's thread. Enter attached the selected child. `02-hover`, `03-wheel`, `04-select`, `05-open` and actual main output in `05-main`.
- `N`, branch `sidebar-created`, Enter created an owning worktree and attached its pi. `f` forked it into a guest in the same checkout and attached that pi; confirmed `x` retired only the fork. `07-created` through `10-abandon`. These used real pi startup with no model call.
- Filter `sidebar-child`, select child, confirmed `m`: retired owning grandchild then child (two threads). Clearing the filter revealed the untouched root/sibling. `n` then created and showed a guest; confirmed `a` retired it. Root `X` retired its two remaining children while preserving the root; root archive then left the registry empty. `13-merge-confirm` through `22-root-archive`. The fixture branches had no changed commits, so this exercised the sidebar/lifecycle routing and worktree retirement, not new conflict-resolution evidence.
- Native window 19112 had exactly sidebar plus main. Clicking displayed the child and then grandchild; the actual main output changed and zmx client counts moved between their `.agent` sessions. [Child](native-child.png), [grandchild](native-grandchild.png), and their AX captures. The earlier [hover frame](native-initial.png) shows all seven buttons in a narrow native split before initial-row auto-attachment was added.
- Final native window 19231 auto-attached its first row. [Final ready](final-ready.png), [AX](final-ready-ax.json). Calling the same frontend `actions.open(child, shown)` with that window's token successfully switched its real main client after the leader-guard repair: [main after switch](final-child.png), [AX](final-child-ax.json). Because this re-drive called the action API, not the UI selection handler, the sidebar's old `▌` marker in that frame is not evidence of a row selection. A different token was refused with `Another window leads this thread; type in this main split before switching`.
- Closing both owned native windows was confirmed by their absence from Cua's window inventory. [After final window close](after-window-close.txt) still lists all four seeded `.agent` daemons and their original PIDs. No seeded thread was archived by closing the window. Explicit fixture stop then removed them all.

Screenshots: live native Ghostty, 1512×944 point windows on a Retina display, English locale; default captures 1568×979. No mocked window content. The private ptys were 40×18 for sidebar and 80×24 for main.

## Discovered limits and owners

The private-pty second viewer could leave an attached session without a leader while the native viewer disconnected. zmx's switch error then killed the source daemon. The sidebar now checks `print-env` and verifies its tracked window token before switching. The successful and refused final action calls above re-drive that repair. A disconnect between check and switch remains upstream: [[projects/mlegls-pi/issues/zmx-switch-without-a-leader-kills-the-source]].

Native Cua pixel input was inconsistent: some clicks attached rows, later child-row clicks toggled the heading instead. The final guard re-drive deliberately used the frontend action API, followed by native observation, rather than claiming those clicks selected the intended row. Owner: [[projects/mlegls-pi/issues/cua-ghostty-pixel-click-lands-on-another-row]]. Closing a sheet used its parent's AX Close token rather than an invalid exact-sheet image: [[projects/mlegls-pi/issues/cua-sheet-capture-shows-parent-window]]. Temporary pty drivers produced every frame but hung at teardown: [[projects/mlegls-pi/issues/private-pty-sidebar-driver-hangs-at-exit]]. They are not the committed verifier entrypoint.

## Checks

`bun-axi test lib/tree lib/thread`: 18 passed, 0 failed, four existing test files. `bunx tsc --noEmit`: passed after the existing nested plugin install. No project `test:affected` or code-lint task exists; `git diff --check` passed. No new permanent acceptance tests. Removed tests covered the deleted tmux dashboard/prune implementation, not the thread lifecycle. Tracker's historical deleted-link diagnostics remain owned by [[projects/mlegls-pi/issues/tracker-check-links-to-deleted-history]]; the in-flight `/thread` sibling's settled blocker is that sibling's file.

Production delta: −760 net lines across the five tree modules; retired tmux-only tests −138 lines. No added dependencies.
