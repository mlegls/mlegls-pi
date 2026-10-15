# GitHub tracker residual join

Independent acceptance on e9a0750b: [predictions, encounter and checks](drive.md), [selected native extracts](independent/api-extracts.json), [complete refresh accounting](independent/refreshes.json). Full replay passed with PR #148; documented post-completion status inspection failed separately and is tracked in native-rehearsal-status-fails-after-completion.

Tested production/setup revision: **9a6ea95693c18a8a2fb2a6ccfa21c0e0dd844fbb** (base **f802ab0c**). This packet follows the final cursor-paging replay, not the superseded alias experiment. Nonvisual: **visual: false; shots: []**. Parent integration and independent acceptance remain with the supervisor.

## Change and contract

The adapter/CLI/reconciler join exposed a real daemon-environment gap: `reconcilerTracker` chose a committed CLI, but `run()` did not export `TRACKER_CLI`, and BB's launch-env allowlist discarded it. Commit **005a8454** makes production `run()` select/export the pin unless explicitly overridden and carries it into each worker's `.wm/launch.env`.

The initial bounded-alias detour (**a5d3b214**) was rejected by the supervisor and reverted in **9a6ea956**. The global spec now records the 2026-10-15 clarification: **one complete logical snapshot per refresh, with every cursor-page request counted**. Production cursor paging is restored unchanged from the base, without a 200-node cap; the existing above-200 regression/first-use fixture are restored. The live controller now starts with `TRACKER_CLI` unset, uses the committed pin for its own CLI calls, and verifies that same revision before every worker launch.

## Prepared target and reproduction

- Deployment: native GitHub API/CLI, only **mlegls/reconcile-pr-transport-20261014-35767b2d** (private, authorized disposable repository), existing **mlegls / gh authentication**. No repository, credentials, account or permissions created; no production webapp writes.
- Reproduction owns a fresh local HTTPS clone, isolated XDG/board/registry state and its newly created native issues. Canonical tracker/triage docs are committed in the scratch repository; no `docs/issues` vault. Inherited history/issues are preserved.
- Readiness before behavior: identity/repository/permissions confirmed, package setup and the original integration gate passed, scratch base **fa4792a54d20c5a27f69bb2a6ccfa21c0e0dd844fbb** had successful Actions job **116362009976**, run **38716994725**.
- Production dispatch/thread/phase/integration path with deterministic shell reports; BB CLI execution is a fixture, not a paid agent. The separate pin probe uses the **real `bin/bb-pi` bridge**, replacing only its `pi` executable with a public tracker CLI invocation.

After `mise run setup`, the first command opens the read-only daemon/worker boundary; the second starts the full native story (~15 minutes):

~~~sh
bun docs/attachments/github-issues-as-a-tracker-backend/pin.ts
bun docs/attachments/rehearse-github-tracked-reconcile/journey.ts run
~~~

Read-only historical story inspection (no seeding/private local files):

~~~sh
bun docs/attachments/rehearse-github-tracked-reconcile/inspect.ts
~~~

Public `journey.ts status OWNED_DIRECTORY` / `cleanup OWNED_DIRECTORY` operate only on a controller's printed manifest. [The guide](../../guide/reconcile-pull-requests.md#rehearsal-and-evidence) has the same delivered entry points.

## Required claims on the final revision

Selected [API/protocol extracts](api-extracts.json) join native node IDs, thread/worker/run identities, claims, phase transitions, PR heads, saved results and cleanup. [Every logical refresh](refreshes.json) records its operations and unique-node/totalCount completeness. Recreate these selections with `bun docs/attachments/rehearse-github-tracked-reconcile/capture.ts OUTDIR OWNED_DIRECTORY`.

### Committed CLI across the daemon boundary — held

`pin.ts` passed on 9a6ea956 with `TRACKER_CLI` absent from the simulated daemon environment: committed pin included the backend, real `bin/bb-pi` loaded `.wm/launch.env`, public `fields gh-96` reported stage done in the intended repository. **Zero remote writes**; temporary clone and pin removed. The final full replay independently recorded **12 worker launches**, each with the same committed CLI revision in launch.env and native mlegls assignment plus exact private run authority before launch. Example: gh-134-implement-1 → thread **c94060c1-90ad-405d-b7b4-b30ceac76252**, run **gh-133**, native node **I_kwDOVJGTm88AAAABXYYpiQ**.

### Native tree, collector unlock, PR target and evidence — held

Spec **#133**, tickets **#134 (a)** / **#135 (b)**, outside dependent **#136**. b and outside have native blocked-by a. a landed into the collector at **9e2b05737179e8ffd2cc68c99fb5299d99952a1a**; b started at exactly that head with a ancestry proven. Both tickets were still OPEN/assigned, outside remained blocked/frontier:false, and no target-closure receipt existed.

One [PR #137](https://github.com/mlegls/reconcile-pr-transport-20261014-35767b2d/pull/137) carried exactly `Closes #134`, `Closes #135`, `Closes #133`, with all three issues still open and workers retired at publication. Both Actions jobs **116364953763 / 116364921834** passed on reviewed head **5c84a421125d82bb0cf5b3c7a2a80911cea84864**. Production pr-merge merged at **10:07:57Z**, commit **bc1cd4ea1d9bf5297d428a65883e440aea62b033**; fetched ancestry proved target landing and the owner mirror updated.

GitHub auto-close and reconciler publication are different clocks; **host child-first closure is not claimed and no issue was reopened**:

| Node | Native closed_at (UTC) | Saved closedAt (UTC) | Exact evidence-linked result comment |
| --- | --- | --- | --- |
| a #134 | 10:07:59 | 10:08:30.545 | [6189602569](https://github.com/mlegls/reconcile-pr-transport-20261014-35767b2d/issues/134#issuecomment-6189602569), 10:08:17 |
| b #135 | 10:08:00 | 10:08:47.535 | [6189609157](https://github.com/mlegls/reconcile-pr-transport-20261014-35767b2d/issues/135#issuecomment-6189609157), 10:08:39 |
| spec #133 | 10:07:58 | 10:09:04.438 | [6189614198](https://github.com/mlegls/reconcile-pr-transport-20261014-35767b2d/issues/133#issuecomment-6189614198), 10:08:56 |

Private saved-result publication is child-first, each native issue has exactly one original result comment linked to its committed evidence at 5c84a421, and outside #136 became frontier after target completion.

### Leaf promotion/restart and failed provisional cleanup — held

Leaf **#138**, inferred spec without stage labels, promoted through its worker's public CLI to ticket; accepted refinement then launched **gh-138-implement-2**. Exact reconciler PID **83590** was killed; restart **85554** preserved the same implement handle, counter **2**, promotion and native/private reservation, without another refine/create.

Failed refinement **#139** had baseline **#140**. Provisional **#141 / #142** were created under exact attempt `reconcile:gh-139/gh-139-refine-1`; #142's successful create response was deliberately lost while the reconciler was absent, then discovered on restart without duplicate creation. Production discard stopped exact writer **90902**, closed both provisional issues NOT_PLANNED, detached/unassigned them, and recorded phase removed; **zero provisional implement launches**. Baseline #140 remained COMPLETED and foreign human-ready #143 survived the discard, still open at that observation. Only terminal fixture housekeeping closed remaining disposable open fixtures.

### Active-run rate-limit hold/resume — held

Two **recorded-reset-file injections**, not exhaustion of the real account, occurred while worker **gh-135-implement-4**, thread **39f22f9c-279a-40c3-b0ed-20758f3e221f**, was active:

- **CLI failure:** hold reset **10:04:08Z**; real public update exited 1 in **153 ms**, typed as a hold, **zero gh requests**. Worker blocked report **mv9dflhr-ek3u87** at 10:03:40.815 was retained, not forwarded to the owner; retry nudge **mv9dgcfl-nuzic5** arrived at 10:04:15.729 after reset. Same implement handle remained; retry succeeded.
- **Pending done:** reset **10:04:58Z**; report **mv9dgp7x-vtrpb6** posted at 10:04:32.301 was unconsumed mid-hold (implement, counter 4). After reset it advanced exactly once to **gh-135-drive-5**, counter 5.
- Both holds: one hold note apiece, **zero GitHub requests, zero owner mail and zero exceptions**. The authorized retained regression exercises this inside production `run()`.

### Complete shared refresh/cache behavior — held

Final transport accounting, including external public CLI writers and cleanup: **44 logical refreshes / 88 snapshot requests** = 44 `TrackerSnapshot` + 44 `TrackerIssues`. Every refresh covered **119–129 issues**, complete and minimal, **zero orphan pages**. Separate operations: 10 creates, 21 writes, 21 PR-host GraphQL queries, 122 REST delegations; one deliberate lost-create-response event.

- 24 warm snapshot/fields/text/CLI reads: **zero requests**.
- Real 61-second expiry: **one refresh / two requests**, 123/123 issues complete.
- External public CLI write: next read **one refresh / two requests**.
- Active worker for 11 seconds, twelve public reads and five-second scheduler loop: **zero requests**.
- Above-200 coverage is a **fixture**, not a live repository-size claim: 256 issues plus 110 comments used `TrackerSnapshot`, two `TrackerIssues`, one `TrackerConnection`. Deliberately missing declared nodes failed closed with count/locator; no silent partial graph.

The read-only prepared-story inspection also passed on 9a6ea956: 119/119 issues in one logical refresh/two requests, three scheduler plus six fields/text warm reads with zero requests, three exact historical result comments, proven merge ancestry, detached NOT_PLANNED provisional issues, no remote writes; local clone removed.

## Regression checks

All affected existing checks passed; no retained test added by this residual join:

- Restored cursor suite: `bun test lib/tracker-github.test.ts lib/reconcile/rate-limit.test.ts lib/thread/bb-pi.test.ts` — **11 pass, 0 fail, 86 expectations**.
- `bun docs/attachments/read-github-tracker-snapshots/reader.ts fixture` — complete 256-issue/110-comment paging, warm cache and deliberate incomplete/error cases passed; `bunx tsc --noEmit` passed.
- Pin seam: existing `lib/wm.test.ts`, `lib/thread/runtime.test.ts`, `lib/reconcile/rate-limit.test.ts` — **12 pass, 0 fail, 46 expectations**, typecheck clean.
- Existing reconciler join-boundary / tracker CLI checks — **27 pass, 0 fail, 698 expectations** before the later pin-only and cursor-restoration changes, covered by the focused final checks above.
- `git diff --check` passed. Full repository integration gate belongs to the parent, not rerun here.

## Cleanup and retained artifacts

Final controller area **/private/tmp/native-reconcile-111fZb**: all three roots stopped, **12 worker threads retired / zero live workers**; exact-PID `ps` of all 17 recorded reconciler/writer PIDs returned none. All ten owned issues are closed/unassigned (#133–135 and #140 COMPLETED; #136, #138–139, #141–143 NOT_PLANNED). PR #137 merged and its remote branch was deleted. No new labels were needed; inherited fixture labels/history and merged artifact commits are preserved. No browser, server, container, tunnel or paid model was started.

The disposable local clone/state and ten local phase/staging branches are intentionally retained for inspection (inventory in api-extracts), not required for replay. Earlier rehearsal packets remain historical under [rehearse-github-tracked-reconcile](../rehearse-github-tracked-reconcile/index.md). No pending product defect or setup blocker remains from this join.

## Danger

**Door:** two-way code/env change; the authorized scratch merges and closed fixture history are intentionally retained. **Blast radius:** workers — the exported tracker CLI must match the reconciler revision; explicit overrides remain supported.
