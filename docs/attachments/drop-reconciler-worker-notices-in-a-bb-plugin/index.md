# Local completion turns

Independent first-use verification: [drive-b encounter packet](drive-b.md).

Tested code: `a5dbd301` (base `2f19b88a`). Nonvisual CLI/API first use under installed BB **0.46.1**, Pi **1.2.0**. [Selected final events and request observations](events.json). No permanent tests added.

## Reproduce

Local BB CLI authentication and existing Pi Anthropic credentials; no new secrets. Use an already Pi-trusted checkout. The fixture owns an isolated repository, extension loader and XDG state under the checkout's `.wm/`. Ownership receipts are seeded; the live prepare process supplies reconciler liveness. **This is not a real reconciler execution**. Child completion, notices, settlement and provider requests are live.

First-use entry (keep alive):

```sh
bun docs/attachments/drop-reconciler-worker-notices-in-a-bb-plugin/setup.ts prepare
```

It prints `NOTICE_FIXTURE_READY <root>`. Then:

```sh
bb project create --root <root> --name local-notice-fixture --json
bb thread spawn --project <project> --environment <root> --provider pi --model anthropic/claude-haiku-4-5 --reasoning-level none --title notice-supervisor --prompt 'Reply READY, then RECEIVED to later messages. Never use tools.' --json
bb thread wait <parent> --status idle --timeout 90 --json
bb thread show <parent> --json
bb environment status <environment-from-parent> --json
bb thread spawn --project <project> --environment <root> --parent-thread <parent> --provider pi --model anthropic/claude-haiku-4-5 --reasoning-level none --title ordinary-title-owned-child --send-at 10m --prompt 'Reply CHILD_FINISHED. Never use tools.' --json
bun docs/attachments/drop-reconciler-worker-notices-in-a-bb-plugin/setup.ts seed <root> <child>
bb thread queue list <child> --json
bb thread queue send <child> <queued-message> --json
bb thread wait <child> --status idle --timeout 90 --json
bb thread log <parent> --json
bb thread wait <parent> --status idle --timeout 90 --json
bb thread tell <parent> 'Reconciler fixture: run complete; this is its own tell, not a core child-completion notice.' --mode queue --json
bb thread wait <parent> --status idle --timeout 90 --json
```

Wait for the parent's child-completed request and its completion before sending the tell: child idle can precede notice delivery. Inspect `<root>/requests.jsonl`: no parent provider-request record for the owned completion; the next record has `ownedNotice`, `localReply` and `completionNotice` false. Spawn another child with no seed call and the same parent to exercise ordinary pass-through; a real parent request then has `completionNotice: true`. Inspect parent log and child show.

Cleanup: delete only this disposable project with `bb project delete <project> --yes --json`, then stop its prepare process. Start a fresh parent after loader edits, rather than relying on CLI tell `/reload-ext` (friction below).

## Observed target and outcomes

Prepared target: project `proj_mrf5sgpesz`, local host `host_w74xscm3fz`, environment `env_hw9i4ucja4`, ready before release. Final parent `thr_c97kxbz46n`, Pi session `pi_326da15a-e47b-4ce9-b155-be1ccb0f9e73`; owned child `thr_daqkajzuw9`; ordinary child `thr_yefgu6f3yi`. Fixture project/threads were deleted and both prepare processes stopped after capture.

| Required claim | Observation |
| --- | --- |
| Owned completion settles idle without provider/error | Notice seq **15**, normal start **17**, fixed reply **26**, zero-token last usage **27**, completed **28**. No parent provider request between initial request **1792385044372** and later tell **1792385071521**. Final parent idle, queue zero, no error event. |
| Child retains status and parent | Owned child idle with `parentThreadId: thr_c97kxbz46n`, preserved in packet. |
| Reconciler tell reaches real model | Agent-authored CLI tell **29**, real request **1792385071521**, RECEIVED **35**, nonzero usage **36**, completed **37**. Tests reconciler transport/payload, not a real run completion. |
| Next real request excludes notice/reply | First request after dropped completion had neither `completed:` nor `Worker completion noted.` in serialized provider payload. Probe records booleans only, not credentials/prompts. |
| Ordinary child reaches real model | Unowned notice **38**, real parent request **1792385097610** contains `completed:` but not local reply, RECEIVED **44**, nonzero usage **45**, completed **46**. Reconciler-looking title did not grant ownership. |
| Plugin absent | `bb/reconciler-notices` already absent at base and remains absent. Pi code documents switching to handled once bb#3792 is fixed. |

The final parent was freshly spawned after probe installation. Its probe checked generic `completed:` and local reply; its owned-ID boolean still named an earlier child, so that boolean is omitted from selected observations rather than presented as proof. The committed setup now reads seeded child ID dynamically; its generated loader and readiness were also tried.

## Checks and friction

- `bunx tsc --noEmit`: passed.
- `bun test lib/notice.test.ts lib/thread/bb-pi.test.ts`: 3 passed.
- `git diff --check`: passed.
- CLI tell `/reload-ext` reached model instead of refreshing fixture: [[projects/mlegls-pi/issues/bb-pi-tell-slash-command-reaches-model]]. Fresh-parent workaround used; no impact on notice behavior.
- Existing upstream owners remain [[projects/mlegls-pi/issues/installed-bb-bypasses-dispatch-hook-for-parent-system-notices]] and [[projects/mlegls-pi/issues/bb-pi-handled-input-leaves-thread-active]].
