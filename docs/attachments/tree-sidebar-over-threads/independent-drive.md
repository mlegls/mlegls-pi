# Independent first use

Revision: 3087a9376409de4749231571c8897ad834552eb0.

## Predictions before opening

Maintainer, local macOS Ghostty/zmx, no credentials/model requests. Committed recipe will prepare a new disposable `/tmp/owned-sidebar-drive-p` owned by this checkout: guest root, owned child/grandchild, guest sibling. Entry: `mise exec -- bun docs/attachments/tree-sidebar-over-threads/fixture.ts sidebar /tmp/owned-sidebar-drive-p`.

- Expect a fresh window with sidebar and one main agent, no auxiliary terminals; selecting a row switches only the main agent.
- Expect spawn and merge trees, with children foldable; scrolling/hover/j/k should never attach.
- Expect hover actions new, new in worktree, fork, merge, archive, abandon; a parent also offers abandon-all-children. New and fork should show the new agent. Destructive actions must confirm and retire the correct subtree; abandoning children retains the parent.
- Expect closing the owned window to leave seeded agents running.

## Encounter

Prepared successfully with the committed recipe; root `/tmp/owned-sidebar-drive-p`, project `/tmp/owned-sidebar-drive-p/project`, four seeded agents. No inherited selector was used. Recipe opened owned Ghostty window 19291 (pid 5885), title `ab tree 3d6b35b4-ae5b-43e6-b7c0-445c7148dd43`. English, macOS, window 1512×944 points; ordinary PNG 1568×979, full-resolution PNG 3024×1888. This is live native interaction with seeded sleeping agents, not mocked window content.

1. [Ready](drive-p-ready.png): spawn hierarchy visible, one main pane saying `Root thread`, first row already shown. Two splits and no auxiliary terminal: **held**.
2. Background pixel click at child-row `(90,71)` unexpectedly toggled spawn → merge. [After click](drive-p-child.png): root still shown, merge hierarchy displayed. Both trees **held** as displayed, but registry CLI equivalence not independently measured. Intended click-to-child expectation **not met**; tooling cause remains uncertain.
3. Exact-window foreground retry of that child click did not switch. Background `j` was refused with `same_pid_keyboard_ambiguity` (another eligible Ghostty window); no unscoped input was sent. Foreground `j` with sidebar pixel focus selected child without attaching; selection became observable in the later [full-resolution capture](drive-p-native.png), still showing `Root thread`. Foreground Enter then showed `Child thread`, and the sidebar's shown marker moved to child: [Opened child](drive-p-open-child.png). Keyboard selection and Enter **held**. Immediate snapshots lagged input; a later fresh capture was necessary.
4. Background pixel wheel down ×3 over sidebar did not change the shown child or open another thread: [After wheel](drive-p-wheel.png). **Held for this four-row seed**, not a large scrollable registry.
5. Tried foreground Tab and then `n`; both refused with `exact target window did not become focused for foreground HID delivery`. These are delivery failures, not product-action failures. No create action was observed. Hover-only input cannot be demonstrated by the advertised window cursor tool (it moves an overlay, not application pointer input). Lifecycle buttons and their effects remain **unobservable** in this pass.
6. Closed window through its exact AX close button, then its parent-window AX `Close` confirmation. [Confirmation](drive-p-close.png) warned `All terminal sessions in this window will be terminated.` Despite that warning, window disappeared and [isolated zmx inventory](drive-p-after-close.txt) showed all four `.agent` daemons alive with zero clients. Closing/detaching **held**. The wording is confusing for this workflow.
7. Reopened through the same committed recipe (window 19322), saw root attached with previous merge mode retained. One bounded foreground `n` attempt with sidebar pixel focus failed `focus pixel-click at (90,55) failed`. Closed this exact window through AX and confirmation; explicit recipe `stop` performed cleanup. No source, tests or fixture implementation were read; no action API substitute was used.

## Expectations and frictions

- Fresh two-split window, main switch on Enter, j without attach, wheel without attach, agents surviving closure: **met** within the seed above.
- Accurate child-row pixel selection: **not met**; click changed tree heading instead. Native tooling owner: [[projects/mlegls-pi/issues/cua-ghostty-pixel-click-lands-on-another-row]]. Foreground key/focus failures also prevented continuing this encounter; same owner has the new observations.
- Hover buttons, fold/filter, new/worktree/fork, destructive confirmation/subtree retirement and conflict routing: **not observed**, not accepted. Remain required by [[projects/mlegls-pi/issues/tree-sidebar-over-threads]] for review/re-drive.
- During use I expected a confirmed key post to be reflected by the next capture: **not met**; child selection appeared only in a later capture. Treat tool success as input facts, not product outcome.
- During close I expected Ghostty's warning to mean agents would terminate: **not met** (beneficial product behavior, misleading host wording). Guide correctly says closing detaches.

## Replayable checks for review

- Prepare committed seed; open sidebar. Accept exactly two splits and root output, with shown marker on root; no auxiliary terminal.
- Select child with j without Enter. Accept root output unchanged; then Enter. Accept child output and child shown marker, with only the main pane switched.
- On fresh spawn tree point/click child text, not heading/fold arrow. Accept child main output, spawn mode unchanged. Record exact input route and capture dimensions to isolate the tooling counterexample.
- Wheel over sidebar then j/k with no Enter. Accept shown marker and main agent unchanged; repeat with enough threads to overflow viewport.
- Hover parent and leaf: accept six labeled lifecycle buttons on both, plus abandon-all-children only on parent. In narrow split every button must remain reachable.
- New, worktree-new and fork: accept new registry row and corresponding main agent; worktree action prompts for branch. Cancel each destructive prompt: registry/processes unchanged. Confirm merge/archive/abandon: only intended subtree retires; abandon-all-children preserves parent in each displayed mode. Conflict must visibly return to conflicting agent. Not measured here.
- Close owned window; accept its absence and all four isolated agents still alive at zero clients. Reopen; accept attach to existing agent without duplication.

## Outcome

The complete `Work in threads` journey is **unobservable**: basic display, keyboard switching and detach held, but the hover/lifecycle path could not be reached reliably through scoped native input. This packet is not acceptance of those missing claims. Cleanup completed through the committed recipe; no owned windows or agents remain.
