# Independent worker-thread encounter

## Starting contract and predictions (before opening the product)

Revision: `09a2bd06639ef90b342a065d07575ad0f40b03a4`. Persona: maintainer using library/CLI and a freshly loaded pi's public supervision tools. Source: the ticket, work-in-threads story and first-use setup index; no implementation, tests or fixture source read. This is a nonvisual backend journey, not sidebar acceptance.

Deployment: recipe-owned disposable local Git project with main and a non-main owner checkout; isolated board/thread/zmx state and pi configuration registering this worktree. Existing pi persona via temporary local auth link. Seed: trivial workers plus a two-level ready tracker subtree. No shared deployment is inherited. Entry: `mise exec -- bun docs/attachments/wm-workers-over-threads/fixture.ts prepare`; then worker/supervisor/reconcile/inspect/cleanup with its printed ROOT. Dependencies prepared with `mise run setup` and the documented nested locked install; both completed successfully.

| Claim | Predicted action and observable result | Outcome |
| --- | --- | --- |
| Worker continuity | Spawn a trivial worker; see one report on run/handle, a thread id separate from current pi session identity, and a second report after deliberate follow-up. A done report leaves it awaitable. | held; expectation met |
| Literal transport/history | Send text without CR; no new report until CR. Read ordinary plain history with follow-up visible. | held; expectation met |
| Lifecycle | Kill .agent and separately an observed pi pid; next listeners see exited. Close retains/discards owned branch as requested and removes active resources. | held; expectation met |
| Observation uncertainty | Break backend/live observation; get a surfaced read error, not a fabricated exited event. Hide live record while observed pid survives; likewise no fabricated exit. | held; expectation met |
| Canonical identity/jump | Resume canonical pi by hand without worker env; thread identity and a fresh thread/<id> report remain. Free pi has neither. A newer free session cannot displace /jump's recorded canonical session. | held; expectation met |
| Public supervision | A freshly loaded isolated pi dispatches and integrates a worker into owner, removes thread/zmx/worktree; integrate keep stays active until retire; retire unmerged retains branch and does not merge it. | held; expectation met |
| Nested reconciliation | With budget 1, a leaf traverses child collector → parent collector → owner, never main. ab-parent reflects destination, not source SHA. After forced exit and daemon restart it reattaches/relaunches within budget. Collector lineage remains explicit. | held; expectation met |
| Cleanup | Cleanup leaves no fixture processes, active threads, terminals, worktrees or auth links. | held; expectation met |

## Session log

- Preparation of this worktree's dependencies completed (no credential values inspected). Existing evidence says previous roots were removed; a fresh prepare will establish ownership/readiness rather than reuse them.
- Fresh prepare completed and printed `/private/tmp/wm-thread-Rv3dZn`, project `ROOT/repo`, owned integration checkout `ROOT/owner`, model `openai-codex/gpt-6.1-sol`; all five board/thread/zmx/agent/roster selectors were rooted under ROOT. Readiness explicitly confirmed registered package/auth link and non-main ownership.
- `worker ROOT` completed (72 seconds, exit 0). Worker `d7be32f2-9964-49ef-80d2-a02d66be44bf` reported `done bootstrap-ok` on `worker-fixture/pi-worker` (`mupjy0uc-k57z57`). Literal text left that id unchanged; deliberate CR produced `mupjy7wt-ozm57d`, `done follow-up-ok`. Plain history showed both responses.
- /jump returned the canonical file rather than newer free `01a0f796-b765-70d1-b43f-d88117f99db6`; after the recorded canonical file changed to `01a0f796-b77c-70d1-b43f-d8838b8705cb`, /jump returned that replacement while thread identity stayed fixed.
- Killing .agent produced exited. keep-close retained `pi-worker`. By-hand canonical `2220f480-403e-456c-b3f3-b49ab375108a` recorded thread in Live and session-meta and emitted `done by-hand-ok` (`mupjyp4x-5csikc`) on its thread topic. Free `01a0f797-1f5c-70d1-b43f-d884847e3338` had neither thread field nor auto-report.
- `3c27afb6-53d7-45eb-9e12-93c4cdc5e9ea`: hiding Live while its pid survived returned no exit and surfaced missing current state. Invalid Live JSON and ZMX NotDir both logged deferred poll errors and no exit events. Killing observed pid 35480 produced exited; discard-close deleted `pid-worker` and listed terminated leftover pids.
- `supervisor ROOT` completed (97 seconds, exit 0), using driving canonical pi `375ea1cf-5402-405c-ad17-a6295967fef0` in owner. Fresh tool receipts supplied thread ids: `322b8a02-8e9c-44f2-8a5d-e4c6da617796` integrated and retired; `505ad1eb-23ed-4ee8-903e-95559ea32c0b` integrated with keep then retired; `8dd84018-1aed-4bd3-b8b6-57ef9a6262b6` retired without integration and retained `tool-unmerged`. Owner contained `integrated.txt` and `kept.txt`, not `unmerged.txt`; readback listed only the driving pi active/terminal. The three reports' ids were `mupk0f1l-gb89tz`, `mupk0xhv-19fbpb`, `mupk1hgg-latrqr`.
- `reconcile ROOT` completed (350 seconds, exit 0). Daemon 98558 and leaf worker `cddaa15b-6779-4667-9de5-b8e89dbaadb7` were deliberately stopped. Daemon 58472 resumed persisted state at `ROOT/repo/.git/reconcile/fixture-root.json`, observed gone after startup grace, and relaunched exactly once (`fixture-leaf-implement-2`). Budget stayed 1; ten worker records ended archived.
- Leaf workers' ab-parent was `tree/fixture-nested`; nested workers' was `tree/fixture-root`; root workers' was `owner`. Both collectors recorded those destination branches. Owner received leaf implementation, evidence and closing commits; main's subject remained `fixture`. Final campaign had finished done, running false, no chains/collectors/exceptions. Durable readbacks: [lineage](drive-lineage.json), [campaign state](drive-reconcile-state.json).
- `inspect ROOT` completed and showed all 17 thread records archived, no Live records, no zmx terminals, and the stopped/done campaign. Git worktree inventory showed only main and owner; `ps` found none of the recorded daemon/driving/by-hand/free/killed pids. These are observations of this prepared root, not inherited self-check results.
- `cleanup ROOT` completed: terminals `[]`, activeThreads `[]`. An explicit filesystem check confirmed ROOT no longer existed, including its auth link and checkouts. No browser, dev server, tunnel or outside/shared service was opened.
- Existing commands run without reading tests: `bun-axi test` reported 177 passed, 2 skipped; `bun-axi run typecheck` passed; `PI_TEST_LOCAL_WM=1 bun-axi test lib/wm.local.test.ts` reported 1 passed; `git diff --check` passed.

## Frictions

No unintended friction encountered. The documented startup-grace delay was visible: recovery logged a relaunch about 127 seconds after the first launch, and the reconciler journey took 350 seconds overall. This met the setup index's several-minute expectation rather than appearing stuck.

Expectations formed during use: after observation errors, I expected deferred observation, not exit (met); after integration I expected owner-only file changes and no worker terminals (met); after cleanup I expected even the temporary auth link to be gone (met).

## Replayable checks

Run the setup index's preparation commands, substitute the fresh ROOT, and run each journey once. These checks are based on observed public output, not implementation inspection:

1. **Follow-up/literal send** — `worker ROOT`: capture first report id; require the literal-unsubmitted before/after ids equal; require the follow-up id differ and body equal `done follow-up-ok`. History must contain both responses with ordinary text rather than terminal-control bytes.
2. **Jump/current identity** — same action: returned file must equal canonical and differ from newerFree. In jump-current, returned must equal replacement current while thread id is unchanged. This drives the registry seam, not the sibling's interactive /new command.
3. **Canonical/free reporting** — same action: by-hand Live and session-meta must name the canonical thread; report topic must be thread/<id> with fresh done body. Free Live/session-meta must omit thread and there must be no auto-report.
4. **Death versus uncertainty** — same action: agent-killed and pid-killed must each produce exited. alive-without-record, invalid-live and backend-failure must produce no events and surface their respective missing-state/parse/NotDir errors. keep-close must retain pi-worker; discard-close must delete pid-worker.
5. **Supervision** — `supervisor ROOT`: require receipts carry three distinct threadIds and board report ids. After integrate+retire and keep+retire, only driving pi may remain active; tool-integrate/tool-keep branches absent. tool-unmerged branch retained; owner has integrated.txt/kept.txt but not unmerged.txt. Integration mode reported rebase.
6. **Nested destinations/restart** — `reconcile ROOT`: require backend threads, owner cwd, budget 1, one relaunch after forced exit/restart, ten archived workers, finished done, no pending chains/collectors/exceptions. Snapshot lineage while branches exist: leaf → tree/fixture-nested → tree/fixture-root → owner. Main must remain at fixture; owner must receive leaf and closing commits.
7. **Cleanup** — `inspect ROOT`, `git -C ROOT/owner worktree list --porcelain`, then `cleanup ROOT`: no Live or zmx terminals, only main/owner checkouts before root disposal; cleanup returns no active threads/terminals; root absent afterwards.

## Scope and evidence limits

All ticket first-use journeys reached their documented surfaces and held in this recipe run. This is independent execution/observation of the committed recipe, not an implementation review or broad audit. No native/sidebar UI was opened; visual false, shots empty. Public supervision was exercised by the fixture's freshly loaded pi and its returned report, not this driver's inherited tools. The parent still owns its explicitly required final fresh-tool join. No product repairs or tests were written.
