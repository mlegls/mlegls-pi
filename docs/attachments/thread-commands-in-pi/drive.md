# Independent drive

Revision: c496408330f2ab4cfcd4751a793eba89c0847cc3.

## Predictions before opening

- Canonical `/new` changes the session, not thread identity. Quitting returns to that new session.
- `/resume` similarly changes the canonical current session.
- `/thread fork --worktree x` creates a child visible in the spawn tree; `/fork-tab` also creates a child.
- Canonical `/workspace PATH` creates a child there, leaving its own cwd intact.
- A free pi remains free after `/new` and `/resume`; `/workspace` retains ordinary switching; `/thread promote` registers it.
- `/thread new`, archive, abandon and merge expose their lifecycle operations through pi.

Setup planned: recipe-owned disposable local Git/pi/zmx fixture, isolated state, existing persona auth link, no model requests. Entry point: fixture prepare then attach returned ROOT.

## Setup and actions

Prepare returned `/private/tmp/thread-commands-mnm8Xt`, a newly created disposable repository and canonical guest `b58b7095-a0ac-4ceb-869c-cae1045fa476`. Attach in a worker-opened Terminal window reached a ready pi composer; inspect confirmed one idle canonical process. No shared deployment or model calls. Terminal viewport 80×24 (1170×742 capture), English UI, installed pi via mise. Only setup metadata, public docs, process environment selectors and product surfaces were consulted; no implementation/tests were read.

1. Canonical `/new`: footer became `mail/854a34f5`; inspect session became `01a0f7ea-80b1-7277-a0ae-e6fd854a34f5`, same thread id. `/quit`: pi restarted from PID 46362 to 91903 with that same new session. **Held; prediction met.** [New-session frame](drive-new.png), [later registry](drive-registry.json).
2. `/thread fork --worktree x`: returned owner child `892998b6-2701-4620-9936-833bba39304e`, branch x. `./bin/ab thread ls --tree spawn` placed it beneath the source. `/fork-tab` returned a second owner child on a UUID-named branch. **Held; prediction met.** [Fork frame](drive-fork.png), [spawn tree](drive-tree.txt).
3. Canonical `/workspace ROOT/repo__worktrees/x`: returned guest child `26a872d6-b4f9-4347-9615-98a9da538772` there; source footer stayed repo/main. **Held; prediction met.** [Workspace frame](drive-workspace.png), [registry](drive-registry.json).
4. Canonical `/resume`, down to older of two empty sessions, Return: UI said Resumed session; registry restored original `b58b7095…` session while preserving thread identity. **Held; prediction met.** [Resume frame](drive-resume.png), [readback](drive-resume.json).
5. Opened a free pi with the same isolated agent/state/board and checkout extension selectors, unset thread/session identity. Exact-window foreground `/new` changed footer to `67c402fc`; `/thread promote` returned a guest record for that session. **Held; prediction met.** [Promotion frame](drive-promote.png), [readback](drive-promote.json). Initial background inputs did not change this window and are not evidence of product behavior (see friction below).
6. Opened another free pi. `/new` changed `ff8b5d7d` to `c731f1a3`; `/resume` selected previously unregistered `854a34f5`, without changing the canonical registry. `/workspace ROOT/repo__worktrees/y` moved this same free process to y with footer `ad5aedf2`; no thread field in its live record, no new thread. **Held; prediction met.** [Actions](drive-free.json), [resume readback](drive-free-resume.json), [workspace readback](drive-free-workspace.json), [workspace frame](drive-free-workspace.png).
7. Canonical `/thread new --worktree y`: returned owner child `92c84c6b…`, branch y, source as parent. **Held; prediction met.** [Actions](drive-lifecycle.json), [registry](drive-lifecycle-registry.json).
8. I tried lifecycle commands from the source with child IDs; each returned usage (IDs are not accepted by pi's command). Attached child x in its own worker-opened Terminal, then `/thread merge`, `/thread archive`, `/thread abandon` without IDs: all returned `Cleanup controller is inside thread …; run cleanup from another terminal`. Registry remained unchanged. **Failed; prediction not met.** The offered pi commands cannot complete their lifecycle operation from their canonical pi, and another pi cannot address the child by ID. [Merge frame](drive-merge.png), [all three errors](drive-cleanup-errors.png), [actions](drive-own-cleanup.json), [unchanged registry](drive-merge.json).

## Frictions and expectations formed during use

- Creation/fork/workspace/promote feedback is dense wrapped raw JSON, rather than a short confirmation or an attach action. Expectation formed: the new child would become visible or offer a way to open it; not met (it was live with zero clients, while source stayed selected). This did not invalidate registry creation.
- Empty sessions are all labeled `(no messages)` in `/resume`; choosing the desired session required age and later registry inspection. Expectation of distinguishable names was not met in this empty fixture.
- Lifecycle error directs me to another terminal, but pi rejects child IDs there. Expectation that the advertised operation had an executable path through pi was not met; reviewer owns repair under the original ticket.
- [Fixture handoff omits CLI/free-session selectors](../../issues/thread-fixture-handoff-omits-cli-and-free-session-selectors.md): PATH ab was an unrelated CLI; workaround used checkout `./bin/ab` and actual owned selectors. A child attach helper initially ran mise outside the checkout and failed before reaching pi; adding checkout cwd resolved it.
- [Cua Terminal background input confirmation](../../issues/cua-terminal-background-input-confirms-another-window.md): confirmed inputs did not change intended free window. Fresh state prevented treating this as product failure; exact-window foreground delivery worked. No claim is made about the destination of initial input.

## Replayable checks for review

1. Prepare/attach; inspect canonical id/session/PID. `/new`, inspect, `/quit`, wait for idle. Accept stable thread id, changed session, new PID on changed session.
2. `/resume`, select an older unregistered session, Return. Accept registry current session equals selection; repeat in a free pi and accept no registry creation or canonical mutation.
3. `/thread fork --worktree x`, `/fork-tab`, `/thread new --worktree y`; inspect spawn tree. Accept owner children with correct parent, unique sessions, requested x/y branches, source cwd/session unchanged.
4. Canonical `/workspace CHILD_PATH`; accept guest child at that cwd and unchanged source. Free `/workspace CHILD_PATH`; accept moved free process and no new registry record.
5. Free `/new`, inspect absence of thread; `/thread promote`; accept guest record for new session and cwd.
6. Attach owning child, invoke each bare lifecycle command on fresh independent children. Accept actual archive/abandon/merge postconditions and completion feedback, not controller-inside-thread rejection. If intended route is another pi, its command must accept the target and produce the same result. Current revision fails all three.

## Cleanup

Both directly launched free pis were quit. Recipe cleanup returned `Owned fixture removed`, stopping its canonical agents and removing the temporary repository, state and auth link. All five worker-opened Terminal windows were closed; their exact window IDs were absent from final list_windows (only untitled menu/auxiliary surfaces remained), and the known pi PIDs were absent. No shared services were stopped. No product repairs or automated tests were made.

## Review

Check 6 failed on c496408 for a located reason: `ab thread archive|abandon|merge` refuses a controller descended from the thread's own pi (it kills that pi), and the pi command both ran the controller as a child of the pi and accepted no thread id. Repair (extensions/workspace/thread.ts): `/thread archive|abandon|merge [<thread>]` takes an optional id, default this canonical pi's own thread. When the target's subtree contains this pi (the thread itself or an ancestor) the controller is started detached so init adopts it, with output in `$TMPDIR/ab-thread-<action>-<id>.log`; otherwise it runs inline as before. A free pi must name a thread.

Replay with real canonical pis in a fresh fixture ([redrive.ts](redrive.ts), screens by [redrive-capture.ts](redrive-capture.ts)), all on the repaired head:

- bare `/thread merge` in an owning child with a commit: archived, file in main, branch deleted, its pi gone.
- bare `/thread abandon`: archived, nothing merged, branch deleted.
- `/thread archive <child id>` typed in the source's pi: child merged and retired, source stays active with its pi alive; its screen shows the result JSON ([redrive-screens.txt](redrive-screens.txt)).
- bare `/thread archive` in a child that has a child: post-order, both merged into main and archived.
- The child's screen right after bare `/thread merge` shows the detached-run notice with the log path (same file).

The original frames [drive-merge.png](drive-merge.png) and [drive-cleanup-errors.png](drive-cleanup-errors.png) show the pre-repair failure and are first-use record only. Not driven: merge conflict from inside (the conflict mail goes to this thread's own agent, which stays alive during the walk; covered by lib/thread/lifecycle.test.ts). Fixture and logs cleaned up; no processes left.
