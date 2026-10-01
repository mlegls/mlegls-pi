# Independent lifecycle drive

Revision: `840781531b1cc7708e96732b41442dfe4a2f50cf`.
Persona: maintainer. Session: `01a0f747-b7c7-7590-9c66-0c61dc503aca`.
Mode: hacking; first-use verification, not a source audit.
Surface: supplied disposable fixture CLI wrapping the public lifecycle library.
No implementation, tests, fixture source or diffs read.

## Predictions before first use

From the ticket, work-in-threads story and setup guide:

1. **Archive conflict → done:** preparation creates an isolated owned git repository, normal agents on zmx and a tracked `conflict.txt` conflict. Archiving parent retires earlier children, requests resolution from child only, leaves parent/main unchanged while waiting, then integrates child → parent → main and removes owned resources when child reports fresh done. Old/wrong-agent done must not resume it.
2. **Archive conflict → blocked → retry:** child blocked returns a persisted marker. Child and parent stay active; earlier archived sibling stays retired. Resolve and retry skips the earlier sibling, integrates the remaining pair, clears the marker and closes resources.
3. **Abandon nested tree with keepBranch:** children close before parent, both branches remain, main does not change; owned worktrees, terminals and pi processes disappear.
4. **Guest archive and abandon:** only guest terminals/pi stop. Shared checkout/branch and unrelated cwd peer survive; no merge occurs.
5. **Canonical pi outside zmx:** archive stops the promoted pi without killing its unrelated cwd peer.
6. **Raw integration:** conflict throws a node/branch/parent/file marker, aborts cleanly, sends no conflict mail and retires nothing; guest integrates nothing. Destination follows ab-parent rather than caller HEAD.
7. **Cleanup/readiness:** fixture setup must complete before actions, with ids/target and isolated selectors printed. Cleanup leaves no fixture-owned live resources or auth links.

These are predictions, not observed results. Outcomes and replayable checks will be appended during use.

## Setup contract

The committed entry point is `mise exec -- bun docs/attachments/thread-archive-and-abandon/fixture.ts prepare done` (repeat with `blocked`).
The handoff describes disposable owned git fixtures, isolated XDG state/board/zmx, and local pi persona via temporary auth symlink. The guide says package selection points at the invoking checkout and cleanup removes generated targets. No inherited deployment selector will be reused for fixture cleanup; only the printed fixture root will be used.

## Encounter log

### Setup — met

`mise run setup` finished successfully (137 installs checked, no changes). `fixture.ts --help` printed runnable commands. Prepared two new targets from this worktree; no implementer target or inherited state selector was reused:

- Done: `/private/tmp/ab-lifecycle-CFlm5U`.
- Blocked: `/private/tmp/ab-lifecycle-TujmZd`.

`inspect` exposed isolated state, board, zmx and agent directories under each printed root. The done target's agent settings selected `/Users/mlegls/dev/mlegls-pi__worktrees/thread-archive-and-abandon-drive-a/`, local `openai-codex` persona, and pi 0.99.2. Its temporary `agent/auth.json` link existed; no credential contents were read. Preparation finished and all six agents had reported `done fixture-ready` before lifecycle actions. No browser, native window or development server was used.

### Raw conflict — held within the observed surface

Ran `fixture.ts integrate ROOT child` in the done target before archive. The wrapper returned `{conflict: {threadId, branch: child, parentBranch: parent, files: [conflict.txt]}}`. Its exit status was 0. Independent `git status --porcelain` in the child returned empty: no unfinished conflict/rebase remained. All thread resources were still present when archive began. The combined subsequent board readback contained only archive's conflict mail, not a separate raw-integration message. The wrapper exposes the conflict value, not the exception class; this drive makes no claim about that class.

### Archive → child done — held

Ran `fixture.ts archive ROOT parent` in the background so inspection could catch the waiting state. At that point:

- Earlier sibling `007923c7-4b0f-4c7c-83ae-9bd3f71ff39f` was archived.
- Parent `83c517de-5854-4a6f-a0a3-802d8549bc0f` and child `c6c69f3b-9260-4d99-8c97-f1f5c08ccf05` were active, with their terminals/pi still present.
- Only child had `blocked.action=archive`, parent `parent`, file `conflict.txt`.
- Main stayed at seed `177eb4b3d88fac05d5430f10549a93bad1ec1527`.
- Exactly one conflict request went to `mail/c08ccf05`; no conflict request went to parent.

The child's old ready report was timestamped 11:45:44.265Z. Archive waited despite that old done. A fresh child `done` arrived on `lifecycle-fixture/child` at 11:46:44.007Z; the same archive invocation then returned closed `[early, child, parent]`, deleted those branches, and listed killed pids including detached child-cwd peer `77878`. Main became `3700830c8b70852c75db93954aac47a78dc00005`, with `conflict.txt` containing `resolved-child`. Independent git history showed the parent's conflict commit, early sibling change and resolved child change in main's ancestry.

A planned negative control (`mail ROOT parent 'Reply only done parent-not-child…'`) was delivered at 11:46:50.671Z, **after** child done and retirement. It did not produce a parent report and cannot establish wrong-agent rejection. That expectation is not met as a measurement, not a product failure. Replay check C2 below belongs to review.

Evidence: [selected done readbacks](drive-done.json), keys `initial`, `rawConflict`, `waiting`, `archive`; [independent git/process checks](drive-readbacks.txt).

### Archive → child blocked → manual resolution → retry — held

Prepared the blocked target, then ran `archive ROOT parent`. The child `2fbaa158-7bfe-4113-ab75-03fc430ef142` received the only conflict mail and replied `blocked fixture-awaits-manual-resolution`. Cleanup returned only early sibling `f75d481a-7090-4af7-912e-d818ab98c67b` as closed/deleted, and returned child's blocked marker with `conflict.txt`. Independent `inspect` retained that exact marker; parent `60e71033-6948-4d40-86d2-04e49f97ec74` and child were active, their terminals/pi remained, detached child peer `46137` remained alive, and main was unchanged at `175aff2245b1498647218f5891f373fd293f1fe1`.

Ran the supplied `resolve ROOT child`, which returned clean status. Re-running `archive ROOT parent` returned closed/deleted `[child, parent]` only: early was not revisited. Both remaining records became archived without blocked markers. Main became `60d5b3c19c9bb1057e790bc6da557d2737c0e518` with `resolved-child`; child peer was absent.

Evidence: [selected blocked readbacks](drive-blocked.json), keys `blocked`, `beforeResolve`, `resolved`, `retry`.

### Raw merge mode — held within the observed surface

After blocked archive returned, before resolution/retry, separately ran `integrate ROOT abandonChild merge`. It returned branch `abandon-child`, destination branch `abandon`, and that branch's worktree path, not this driver's cwd. Git showed destination commit `610091005abebfa05825a3163556cb22291756cb` with two parents, despite the child being fast-forwardable. Both abandonment threads/terminals/pi remained active; raw integration retired neither. This supplemental action affected only the abandonment pair, not the conflicting parent/child pair or main.

### Nested abandon keepBranch — held

Ran `abandon ROOT abandon keep` in each target. Both returned closed `[abandonChild, abandon]`, no deleted branches, and kept both branches with reason `keepBranch requested`. Main's HEAD before/after matched exactly (done target: `3700830…`; blocked target: `60d5b3c…`). Owned worktree paths, terminals and pi processes disappeared. Independent git still listed both branches, including the unmerged child change. The done target tested the untouched nested abandonment seed; the blocked target additionally tested retention after the explicit raw merge above.

### Guest archive/abandon and external canonical pi — held

- Done target: `integrate ROOT guest` returned literal `undefined`. `archive ROOT guest` closed only guest `6aae979e-59be-43bb-a20d-9f3a38b47556`, with no deleted/kept branch entries. Its agent/server terminals and pi disappeared; main/checkout/kept branches remained unchanged, unrelated cwd peer `86825` stayed alive.
- Blocked target: `abandon ROOT guest` closed only guest `a52674ab-5374-4052-818b-fe3695d85119`, with no branch deletion; shared checkout/main and peer `53686` survived.
- Done target: `external ROOT` promoted canonical RPC pi `58601` (thread `01a0f74a-858c-75ef-9697-c501a16af220`) outside zmx and archived it. Its live record was absent afterward, cleanup listed its pid, and peer `86825` stayed alive. Independent `kill -0` found canonical pi absent and peer alive.

### Final cleanup — met

Before fixture cleanup, independent shell checks found every owned worktree absent, all selected retired canonical pids and detached child peers absent, and both unrelated shared-cwd peers alive. `cleanup ROOT` then returned `active: [], zmx: [], live: []` for each target. Both printed roots (including temporary authentication links) were absent; both explicitly owned peers were now absent; no process command referenced either target. No inherited/shared service was stopped. No resources started outside this worktree remain.

## Frictions and expectations

- **Met:** setup readiness, old ready done ignored, child-only conflict routing, main held while waiting, fresh child done continuation, persisted blocked marker, safe partial retry, keepBranch retention, guest isolation, outside-zmx pi retirement, final cleanup.
- **Not met as a measurement:** wrong-parent fresh done rejection; the attempted control arrived too late. No product failure observed. Current-session moves and checkpoint/needs-input/no-status negatives were not attempted; they belong to review's contract checks, not the normal-agent acceptance replay above.
- **Tooling friction:** fixture commands print full repeated thread/session/spawn readbacks; scanning the relevant status required saving stdout and extracting selected fields. Raw conflict also exits 0, so exit status alone did not tell me integration had been refused. Recorded with the existing [fixture tooling owner](../../issues/thread-fixture-help-and-headless-pty-entry.md); no product/source repair made.

## Replayable checks for review

These describe observable acceptance, not test implementations.

- **C1 — fresh done and post-order:** prepare done; raw-integrate child and observe clean refusal; start parent archive and inspect before child done. Accept only child conflict mail/marker, early archived, parent/child live and main unchanged. After canonical child fresh done, accept closed order early/child/parent, expected git changes in main, branch/worktree/terminal/pi removal, and detached child peer absent.
- **C2 — report identity/freshness:** delay the resolving child's reply in an owned normal-agent fixture. While archive waits, obtain a fresh parent's done, and a done from another agent on the child's topic; neither may retire the child or advance main. Switch child's current canonical session; old-session done must not resume, current-session done after resolution must. Also try checkpoint, needs-input and an untagged/non-status reply; none may count as resolved. This drive established only the old-ready-done negative and genuine current child's done positive. Reviewer owns the remaining controls.
- **C3 — blocked retry:** prepare blocked, archive parent, compare returned and persisted marker; require only early retired, parent/child resources present, main seed unchanged. Resolve child and retry; require only child/parent newly closed, marker cleared and detached child peer gone.
- **C4 — keepBranch/no merge:** prepare a fresh nested abandon tree, record main HEAD and both branch tips, abandon with keep. Require child-before-parent closure, same main HEAD and branch tips, no owned worktrees/terminals/pi, and both branches retained with reasons.
- **C5 — guests and external pi:** in a shared checkout with an explicitly owned unrelated cwd peer, raw guest integrate must yield undefined. Guest archive and guest abandon must remove only their own terminals/pi and retain checkout/HEAD/branch/peer. Promote outside-zmx canonical pi; archive must stop that exact pid and preserve peer.
- **C6 — raw merge destination/lifetime:** on a fast-forwardable owned child, invoke raw integrate in merge mode from a different checkout. Require returned ab-parent path/branch, two-parent destination commit, and no thread retirement. This drive observed that ordinary destination/lifetime behavior. Reparent to a branch different from spawn lineage, missing/deleted ab-parent, dirty child/destination, prepare-hook failure, and merge-bearing child update are reviewer-owned contract controls not observed here.
- **C7 — resource truth:** independently check retired worktree directories and `kill -0` for known canonical/leftover pids, not only fixture cleanup JSON. Guests' unrelated peer must stay alive until explicit fixture teardown. After fixture cleanup, root/auth link and every owned fixture process must be absent.

No source, diffs, tests or fixture source were read. No automated tests written; no product repairs made. The parent owns the later actual-CLI two-level conflict replay after consumers land, as required by the ticket.
