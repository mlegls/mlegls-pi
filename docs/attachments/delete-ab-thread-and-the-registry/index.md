# First-use verification

Revision: `041013805c337cd275f7aca075d37485e60dc042`.
Nonvisual CLI encounter; no screenshots or services.

## Predictions (recorded before product use)

1. `bb thread show` with my bb ID identifies this worker and checkout without an ab record.
2. Worktree setup status is in `.wm/`, not a shared ab-thread registry.
3. The documented lifecycle surface permits a live reconcile to spawn, integrate and retire a worker.
4. Removed `ab thread` is not the documented lifecycle surface. Source deletion and compiler/test gates belong to review, not this black-box drive.

## Setup

CLI/library deployment: owned checkout `/Users/mlegls/dev/mlegls-pi__worktrees/delete-ab-thread-and-the-registry-drive-9`; bb thread `thr_bi6fcdphqi`; environment `env_nhyaj4pkk7`. Persona: local worker operator, inherited bb session authentication; no seed. Implementer handoff was literal JSON null. User supplied completed `mise run setup` log at `/Users/mlegls/.local/state/ab-threads/efb271eb-3965-476b-ad68-2a302948f4f7.setup.log`. Both dependency installs completed successfully. `bb thread show --self --json` confirms environment path equals this checkout and environment status is ready.

## Encounter and outcomes

- **Held, bb identity:** `bb thread show thr_bi6fcdphqi` and `bb thread show --self --json` both resolve this worker, its parent and environment. JSON includes this exact checkout path. Prediction 1 met.
- **Unobservable, new setup persistence:** `ls -la .wm` showed only `launch.env`, no `setup.json` or `setup.log`. Supplied completed setup log is outside the checkout under old ab-threads state. Prediction 2 not met in this starting state, but no fresh worker was launched to distinguish inherited setup from behavior on this revision.
- **Unobservable, live lifecycle:** README and `docs/dispatch.md` document bb workers and integration; `bun lib/reconcile/main.ts --help` successfully presents start/run, stop, status, resolve and constrain. No disposable lifecycle issue or prepared scenario was supplied. The active parent run owns this execution issue. I did not restart that run, integrate myself, or invent another agent's implementation task. Prediction 3 remains unobserved; help alone is not lifecycle evidence.
- **Partially observed, documentation transition:** README and dispatch guide direct thread inspection to bb. `ab --help` on PATH still prints `usage: ab thread ... | ab desk ...` and exits 2; `command -v ab` resolves `/Users/mlegls/.local/bin/ab`, not an entry point proven owned by this checkout. This ambient command is not accepted as evidence against the tested head. Prediction 4 held only for the two read docs; exhaustive migration and CLI deletion remain unobservable.
- **Unobservable, internal deletion / workspace migration / integration configuration / test gates:** not inferred from implementation. No source, diff, tests or fixtures read, and no test suite or typechecker run, per driver role.

## Frictions and owner

Null handoff required discovering bb identity and the lifecycle entry point. Setup evidence refers to shared legacy state, and no isolated lifecycle scenario was supplied. Existing owner updated immediately: [[projects/mlegls-pi/issues/supervised-study-drive-lacks-setup-handoff]]. The ambient legacy CLI is an observation, not a demonstrated product regression.

## Replayable checks for review

1. In a worker shell, run `bb thread show --self --json`; accept only matching bb ID, exact owned checkout path and ready environment. Observed pass here.
2. From this committed revision, launch a disposable worker via documented reconcile setup; after setup completes inspect its `.wm/setup.json` and `.wm/setup.log`. Accept a completed status beside that worker and no dependency on a shared registry. Not driven here.
3. Supply an isolated ticket with a harmless committed change; start checkout-local reconcile with an owned bb owner ID. Observe worker creation, accepted change integrated into that owner's target, and bb retirement/worktree cleanup. Accept only all three observed, not CLI help or this driver's existence. Not driven here.
4. Use the explicitly checkout-owned CLI/package entry point to confirm `ab thread` is absent; do not use ambient PATH `ab` as evidence for this revision. Not driven here.

No servers, pages, containers, child workers or background processes were started. Acceptance remains incomplete; reviewer must obtain the live lifecycle/setup observations rather than treating this packet as approval.

## Review (fresh head; appended after the driver's first-use record)

Live lifecycle driven in a disposable scratch repo (`/tmp/scratch-reg-live`, a `setup` mise task, no `.gitignore`, one ticket `add-hello`), `reconcile start add-hello --owner <reviewer bb thread> --budget 1 --land local`; scratch repo, bb project and worktrees removed afterwards, the reconciler had finished (`finished: done`).

- **Held, live reconcile spawns, integrates, retires:** the reconciler launched implement-1, drive-2 and review-3 as bb threads, landed `add-hello` in the owner's checkout (HELLO.md on main, tree clean), left no worktree, archived all three bb threads and deleted their environments.
- **Held, setup status beside the worktree:** in drive-2's worktree before retirement, `.wm/setup.json` was `{"state":"done","code":0,...}` and `.wm/setup.log` held the setup output, with `.wm/` auto-excluded via `info/exclude` (status clean for integrate).
- **Held, legacy CLI and records removed:** `bin/ab` offers only `desk`; no source references `ab thread`, `lib/thread/registry`/`cli`, `ThreadRecord`, `getThread`/`threadForBb` (grep; tsc clean); skills and docs outside historical attachments name no `ab thread`.
- Full `bun test` on the reviewed head: 214 pass, 2 skip, 0 fail; `bunx tsc --noEmit` clean.
- Repairs: removed a stale doc comment on `Worker` (wm.ts) and flattened leftover bare blocks in `cleanupThread` and `retire` (behavior-preserving; affected tests pass).
- Observation: landed chain branches (`add-hello-implement-1`, `-drive-2`) remain in the scratch repo after retirement, as they do in this repo for earlier runs; not introduced here.
