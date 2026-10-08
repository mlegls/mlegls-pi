# Reconcile stop first use

Implementation self-check, not independent acceptance. Runtime revision: 6f77315.

~~~text
reconcile_stop({issue}) / main.ts stop <issue>
  → stop reconciler PID
  → retire worker and handler threads, owned processes and worktrees
  → keep unmerged branches and tree/<slug> collectors
  → finished: stopped; no worker or handler receipts
~~~

A persisted stopping latch prevents owner-session startup from restarting a run during cleanup. If retirement fails, stop can be retried; it does not report successful completion.

## Replay setup

Required environment: local Git, Bun and the project's mise-managed zmx. No Cloud deployment, model, browser or credentials. Use this checkout's existing setup:

~~~sh
mise run setup
bun install --frozen-lockfile --cwd extensions/obsidian-tracker
bun docs/attachments/stopped-supervise-jobs-have-no-cleanup-path/fixture.ts prepare
~~~

Prepare creates its own short temporary root, isolated thread/board/zmx/agent state, Git repository on main, tree/fixture collector, three shell-worker threads with unmerged commits, and a leftover process in the implementer's worktree. A live reconciler adopts the seeded chain and handler. The launch-race worker is registered but deliberately absent from the persisted chain. Prepare waits for the reconciler's started mail and matching persisted PID, then prints ROOT, all selectors and a directly runnable stop command.

~~~sh
bun docs/attachments/stopped-supervise-jobs-have-no-cleanup-path/fixture.ts stop ROOT
bun docs/attachments/stopped-supervise-jobs-have-no-cleanup-path/fixture.ts inspect ROOT
bun docs/attachments/stopped-supervise-jobs-have-no-cleanup-path/fixture.ts cleanup ROOT
~~~

Stop invokes the public main.ts CLI with the fixture's isolated selectors. Inspect reports campaign status, active threads, terminals, process liveness, remaining worktrees and branches. Cleanup removes the entire owned fixture, including preserved branches and collector. Cleanup is required even on failure. Worker shell fixtures sleep for ten minutes; prepare a fresh root if one has expired.

No resident target is inherited. The observed roots /private/tmp/rc-stop-hgypRF and /private/tmp/rc-stop-uJIsvP were removed after use; the committed prepare command reproduces the starting state.

## Observations

On the fresh /private/tmp/rc-stop-uJIsvP target (reconciler PID 35232), CLI stop returned finished: stopped, running: false, stopping: false, empty chains and exceptions. It retired implement, handler and launch-race. Inspect then showed:

- active threads and zmx terminals: empty;
- reconciler and leftover process: not alive;
- worker worktrees: absent;
- implement, handler and launch-race branches: retained;
- main and tree/fixture: still checked out, at the same seed commit.

Retired thread IDs: implement c41c13df-09e9-4618-a36b-bf63726c4bbc; handler 4920bcf6-d6b7-4852-abc5-ca86d89ef9b0; launch-race 110435f7-0344-40c4-b2d5-ccf32f83f150. The implementer's retirement receipt included leftover PID 35222.

The approved shell-worker regression additionally reads each retained branch's committed file, checks archived thread records and absence of their terminals, and repeats stop. A registered-dataTool execute diagnostic returned stopped through reconcile_stop and finished/stopped through reconcile_status. That diagnostic used a registration host stub, not a model-driven live pi session.

The first CLI attempt exposed a fixture error: its child did not receive the modified isolated environment and failed with “No registered worker fixture/implement”. The run PID had stopped, and stopping remained true. Commit 6f77315 passes process.env explicitly to the CLI child. Retrying retired the workers, and the fresh CLI replay above completed without that error.

## Checks

- bun test lib/reconcile/stop.test.ts: 1 passed (23 assertions).
- bun test lib/reconcile/constraints.test.ts lib/reconcile/checkpoint.test.ts lib/reconcile/refresh.test.ts: 3 passed.
- bun run typecheck: passed after the nested package install.
- git diff --check: passed.

The initial typecheck reported only missing Obsidian types and cascading DOM/plugin diagnostics. Installing the nested package's frozen dependencies made the unchanged check pass; the setup owner is [root-setup-still-omits-obsidian-typecheck-dependencies](../../issues/root-setup-still-omits-obsidian-typecheck-dependencies.md).

## Danger

Door: one-way for uncommitted files in retired owned worktrees; unmerged committed branches and collectors survive. This is the existing retirement policy, not a merge or discard operation.

Blast radius: run. The reconciler stops launching before cleanup; workers registered under that run in the same repository are included even if their launch receipt was not yet saved.
