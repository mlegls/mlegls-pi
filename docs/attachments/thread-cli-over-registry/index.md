# CLI first-use verification

Driver revision: `aea423624d384f3110deaf6d463e75e57d850c2c`. CLI-only encounter; no implementation, test or fixture source read. Persona: maintainer using the checkout's `bin/ab`. No rendered UI.

## Predictions before first use

1. New returns a single parseable ThreadRecord JSON even if a worktree setup task logs; `ls` JSON/text show the same ids, canonical identity, ownership and tree depth in spawn and merge orders.
2. Fork from current PI_SESSION_FILE/ID copies history into the requested destination; missing/current/ambiguous ids and mutually exclusive destinations fail without creating records or terminals.
3. Send passes literal text and stdin without an implicit CR. History exposes that exact text. Attach an auxiliary shell runs in the thread cwd and leaves its labelled terminal alive after detach.
4. Archive closes descendants before their parent, merges owned worktrees, and excludes retired rows. Guests merge nothing; promote and abandon preserve their shared checkout.
5. Merge has archive's same lifetime, blocked nonzero exit and persisted marker; resolving a conflicting child allows retry without re-retiring an already closed sibling. A guest merge preserves checkout and peers.
6. `ab tree` still reaches its existing non-UI CLI surface. Existing regressions and typecheck pass after the documented setup.

## Setup

Required deployment: disposable local git fixture owned by this worktree, isolated state/board/zmx. Shell fixture needs no credentials; the documented lifecycle fixture supplies normal pi/auth for conflict resolution. Inherited PI_SESSION_FILE/ID identify the driver and will be unset/replaced for fixture commands; inherited XDG state will never be used for product operations.

## Encounter

Creation, both list orders/formats, literal send/history, auxiliary attach/detach, promote/abandon, archive and merge conflict/blocked/resume held. Fork copied history to both destinations, but **lost its registry parent when PI_SESSION_FILE was present without a matching PI_SESSION_ID**. This current-session identity path needs reviewer repair. Ambiguous worker-alias rejection was not observable through the provided CLI creation grammar; review owns that remaining control.

Evidence: [CLI actions and exact stdout/stderr/exit](commands.json), [fixture readiness and lifecycle snapshots](lifecycle.json), [forked session histories](sessions.json), [persisted registry records](registry-final.json), [PTY attachment output](attach-pty.txt), [regressions/typecheck](regressions.txt), [independent teardown](cleanup.json).

The original predictions above were written before opening the product. Detailed observations and replayable checks follow.

### Starting state and reproduction

`mise run setup` completed with the frozen root dependencies. Ran the documented `mise exec -- bun docs/attachments/thread-archive-and-abandon/fixture.ts prepare blocked`, then a second `prepare done`. Each waited for canonical pi agents to report fixture-ready before returning owned targets and identities; their full non-secret selectors and readiness are under `lifecycle.json` → `lifecycle-prepare` and `done-prepare`. The isolated agent directory loads this checkout; normal local authentication is a temporary symlink managed by that committed fixture. No anonymous fallback was substituted.

Both roots below are deleted. Recreate them with prepare; do not reuse the historical paths. For every CLI command, unset the inherited driver identity and ZMX_SESSION, then export the printed environment:

```sh
unset PI_SESSION_ID PI_SESSION_FILE ZMX_SESSION
export XDG_STATE_HOME="$ROOT/state" PI_BOARD_DIR="$ROOT/board"
export ZMX_DIR="$ROOT/zmx" PI_CODING_AGENT_DIR="$ROOT/agent"
export MISE_TRUSTED_CONFIG_PATHS="$ROOT"
AB="$CHECKOUT/bin/ab"
```

The historical blocked root was `/private/tmp/ab-lifecycle-jvkTmu`; done root `/private/tmp/ab-lifecycle-Bga8EA`. `commands.json` gives actual executable paths, args, cwd and outputs for every action; named keys below are evidence references, not test names.

### New → both trees → fork — partly failed

From `$ROOT/repo`, committed a mise setup task that prints `SETUP-NOISE` and touches `setup-ran`. `new --worktree cli-logs --base main --cmd 'printf cli-log-ready'` returned one parseable JSON object, no setup chatter in stdout. `setup-readiness` found `?? setup-ran`, so setup actually ran despite its output not being forwarded. Removed that owned marker before retirement.

`new --worktree cli-owner --base main --cmd 'bash --noprofile --norc'` returned owner `09060bac-0e21-48df-a4bf-5a48c3c45aa9`. A guest pi with `new --in "$ROOT/repo" --prompt 'Reply only done cli-ready. Do not use tools.'` returned `3dabf790-624e-44cf-9982-0411a7a35d79` and completed its prompt. `new --worktree cli-child --parent <cli-owner> --cmd 'printf child-ready'` recorded the parent's id and branch. After committing `cli-child.txt`, archive later merged the child's content into main.

The initial six fixture rows' id/sessionId/sessionFile/cwd/ownership matched their persisted registry records. Text and JSON had the same order and two spaces per depth. Later, `ls-distinct-spawn` nested fork worktree `60bf941e-40af-4c77-b61a-3d3a09b25e16` under its pi source at depth 1; `ls-distinct-merge` correctly showed it at depth 0 because its merge parent was main and that thread was a guest. Both text formats matched their respective JSON depths. Working shell, idle pi and exited one-shot states appeared; report and blocked markers appeared during conflict. Archived rows vanished.

Fork history/destination held: `fork --worktree cli-fork` with matching source id/file returned an owner with the right parent. `fork --in <cli-owner-cwd>` copied the source user and assistant messages unchanged, created a guest there, and persisted the destination cwd rather than a blank history. `sessions.json` preserves both source and fork messages.

**Current identity failed:** with a valid source PI_SESSION_FILE and `PI_SESSION_ID=intentionally-wrong-id`, `fork --in "$ROOT/repo"` returned `1a1d1b95-7d40-4560-af7c-43335f46a6b5` with the correct copied history but no parent. With only PI_SESSION_FILE, `fork --in <cli-owner-cwd>` returned `bfed9375-6f47-4308-9226-70eccdc18eaa`, also without parent. Both appeared as independent spawn roots. In contrast, matching id/file `fork-worktree` recorded parent `3dabf790…`. File preference therefore selected the right history but did not resolve the parent through the registry. Expectation formed while using it: changing cwd must not erase who spawned the fork. Not met.

Invalid/missing ids, missing current identity, both destinations and base without worktree exited 1 on stderr, without adding active rows. `history 3` returned Unknown thread, not an ambiguity result; partial UUIDs are not a demonstrated resolver route. A truly duplicated worker alias cannot be seeded with this CLI grammar, so that control remains unobservable here and belongs to this ticket's reviewer, not a waived gate.

### Literal send/history and auxiliary attach — held

Sent `printf 'CLI-LITERAL-$HOME-;-[brackets]'` as a literal argument to the shell-backed agent. `history-unsubmitted` showed only the typed command, not execution. Sent an explicit CR through stdin; `history-submitted` then showed literal `$HOME`, semicolon and brackets in the output. Repeated through omitted-text stdin with `printf 'STDIN-LITERAL-$USER-;'`: again no execution until an explicit CR. The two public routes added no CR themselves and did not expand shell metacharacters.

Attached `<cli-owner> --role cli-aux` through a worker-owned Python stdlib PTY, 140×30, with inherited stdio. Typed `printf 'AUX-CWD:'; pwd` and saw the owning cwd. The zmx inventory had `thread=<cli-owner> role=cli-aux` and clients=1. Ctrl-backslash detached with exit 0; the same terminal/pid remained with clients=0. Auxiliary history and raw PTY output are retained. Archive later removed both roles. No desktop or browser was opened.

### Archive conflict → own agent done — held

Done fixture ids: parent `4bd13adc-62e4-452b-acbb-4d3fa427216a`, early `4f305516-ce08-4bb5-910e-817021a81d5c`, child `47d3b0d1-e4a5-49bd-b760-453d51133961`.

Invoked actual `ab thread archive <parent>`. After 2 seconds, early was retired; child/parent remained, main stayed at seed `8abce983…`, conflict mail went only to `mail/51133961`, and the detached child-cwd peer still lived. After the child's canonical fresh done on `lifecycle-fixture/child`, the CLI returned exit 0 with closed/deleted order `[early, child, parent]`. Final main `d8bda4ff…` contained `resolved-child`; live and zmx were empty after also archiving the guest and abandoning the separate nested tree. Child peer pid 26256 was absent while unrelated shared-checkout pid 43814 remained alive until explicit teardown. `archive-done-result` and the waiting/final snapshots establish the temporal path, not just a final list.

### Merge conflict → blocked → resolve → retry; guest — held

Blocked fixture ids: parent `3dbe61bd-be78-4d6c-914f-9516ff18765d`, early `164e1599-7248-4352-a05e-641da60759dc`, child `e3b17a28-2c29-40b9-9007-ef90b007dda9`.

`ab thread merge <parent>` retired early, sent conflict mail only to the child, and stopped on that agent's blocked response. Exit 1, structured cleanup JSON on stdout, matching child id/reason on stderr; persisted `ls --json` marker and text marker agreed. Repeating via `archive <parent>` also exited 1 with the same marker and closed `[]`, proving retained partial progress.

Ran the documented `bun docs/attachments/thread-archive-and-abandon/fixture.ts resolve "$ROOT" child`, then actual `merge <parent>`. Exit 0, closed/deleted `[child, parent]` only, no early duplication; main had `resolved-child` and marker disappeared. `merge <guest>` closed only guest, returned no branch deletion/retention, preserved the shared checkout and unrelated pid 83303. These are the same retirement lifetime/output/exit behaviors as archive, not raw integration.

The shell owner's later `archive` retired `[cli-child, cli-owner]`, removed the aux terminal, and main contained `child-change`. The pi source's archive retired its correctly-parented worktree fork first, then its guest source. All CLI rows were excluded after retirement.

### Promote, abandon and legacy route — held

`promote` defaulted to PI_SESSION_FILE even alongside the intentionally wrong id; repeated explicit current id returned the same guest record. A separate free pi was created through documented `pi --approve --session <owned-file> --print 'Reply only done free-cli-ready. Do not use tools.'`; `promote` registered that saved session as guest `01a0f75f-600f-7140-afb5-1ad4ffb0a401`. `abandon` closed its terminals/processes, with no branch removal, preserving main and its unrelated process. Also abandoned a guest fork without removing its cwd.

`ab tree` in the isolated fixture exited 0 with the existing project/session text tree and opened no shared UI (`tree-no-ui`). `ab tree --help` instead produced a Bun unknown-option stack trace; recorded separately in [the existing-tree CLI friction](../../issues/ab-tree-help-runs-option-validation.md). It did not prevent the requested routing check.

### Regression, setup friction and cleanup

177 regressions passed, 2 skipped, none failed. Typecheck initially failed only on missing Obsidian dependencies and resulting plugin diagnostics after root setup. The already-documented `bun install --frozen-lockfile --cwd extensions/obsidian-tracker` workaround made unchanged `bunx tsc --noEmit` exit 0. Owner: [root setup dependency friction](../../issues/root-setup-still-omits-obsidian-typecheck-dependencies.md). No product or test files were read or repaired.

Both fixture cleanup commands returned `active: [], zmx: [], live: []`. Independent cleanup checks found both roots/auth links absent, all selected retired child/peer pids absent, and no process command referencing either target. Before teardown, only main remained in git worktree inventory; no active CLI row or zmx session remained. All fixture resources started outside this worktree were stopped. No shared/inherited service was stopped.

## Expectations and replayable checks for review

- **C1 / met — JSON and tree truth:** commit a mise task that prints and touches a marker; create owning and guest threads. Accept a single creation JSON object, executed setup marker, text ids/order/indent matching JSON depth, and id/current-session/cwd/ownership matching persisted registry records. Compare a spawn child whose merge parent is main to distinguish the two tree modes.
- **C2 / not met — source identity and history:** from a registered pi with one completed turn, fork into another cwd with matching id/file, then with valid file plus absent/stale id. Accept copied source messages, destination header/cwd, registry-resolved source parent in every case, and spawn depth 1. The last two cases currently copy history but lose parent.
- **C3 / met except ambiguity control — refusal without side effects:** snapshot active rows and terminals; try unknown id, omitted required id/current identity, both destinations and base without worktree. Accept nonzero stderr-only errors and unchanged resources. Separately seed two workers with the same bare handle in different runs; bare handle must refuse as ambiguous and qualified handle must resolve. That last seed/control is reviewer-owned and was not observed here.
- **C4 / met — literal bytes and attach:** send shell text containing dollars/semicolons/brackets via argument and stdin, inspect history before explicit CR, then after. Accept no execution before CR and literal output after. Attach new aux role through PTY, execute pwd, detach; accept correct cwd/labels and unchanged pid with clients=0 until archive removes it.
- **C5 / met — archive and merge lifecycle:** replay the done and blocked fixture preparations through actual CLI, not the fixture's library archive command. Accept child-only conflict mail, main held while waiting, early retired once, fresh child done retirement, blocked exit 1 with identical persisted marker, safe post-resolution retry, expected git content and owned resource removal. Repeat with guest: no merge/branch deletion, shared cwd and unrelated peer preserved. Commands and ids above provide the exact observed replay.
- **C6 / met — promotion/abandon:** make a free saved pi via print, promote with current-file default, abandon. Accept exact session id/file retained, guest ownership and canonical processes stopped without deleting shared cwd/branch/peer.
- **C7 / met — routing and cleanup:** run `ab tree` without UI under isolated selectors; accept its ordinary text tree. Run regressions/typecheck with documented dependencies. Independently inspect git worktrees, selected pids and roots before/after owned fixture cleanup; accept no resource leak and no interference with inherited services.

Frictions: current-file fork lineage loss (this ticket, C2); [multiline blocked reasons spill text rows](../../issues/thread-list-blocked-reason-spills-rows.md); legacy tree help and root setup dependencies have the linked tracker owners above. Detailed fixture inspect output is verbose; saving and selecting the relevant fields worked, as already recorded by [the fixture tooling owner](../../issues/thread-fixture-help-and-headless-pty-entry.md).

## Review

**C2 repaired.** `lib/thread/cli.ts` fork only resolved the spawning parent when `PI_SESSION_ID` was set, and passed that id straight through; with a file-only or stale id the source thread was never consulted. It now resolves `threadForSession(PI_SESSION_FILE || PI_SESSION_ID)` (the same source it forks history from) and hands that thread's current session to `forkThread` as `parentSession`. Ambiguous canonical sessions still fail before side effects (the registry throws); an unregistered source yields no parent.

Retained as `lib/thread/cli.test.ts` (replays C2 over a shell-backed source thread, in-process CLI, isolated state/zmx): fork `--in` records parent = source thread with matching id/file, file only, file + stale id, and id only. Verified it fails on the pre-fix `cli.ts` and passes after. Not re-driven with a fresh driver: the new test exercises the same public CLI entry with the same env combinations the driver used.

**C3 ambiguity control.** Already encoded by `lib/thread/runtime.test.ts` ("a bare worker handle shared by two runs is ambiguous until its run is given": bare handle throws `Ambiguous worker`, run-qualified resolves). The CLI grammar can't seed duplicates, so the control stays a registry-level test; nothing further owed. Story outcome: held.

Also removed a dead `"thread command failed"` rethrow from the CLI error handler (nothing emits that text; it would have turned an ordinary backend failure into a stack trace instead of stderr message + exit 1).

Left as evidence only (not retained as tests): C1, C4–C7 need real pi/fixture lifecycle runs or document this ticket's design outcomes; lifecycle behavior is already guarded by `lib/thread/lifecycle.test.ts` and the archive-and-abandon packet.

Final head: `lib/thread` + all of `lib` tests 138 pass / 2 skip / 0 fail; `tsc --noEmit` clean apart from the known obsidian-tracker dependency friction.

