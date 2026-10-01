# Independent first-use log

Revision: `692b5df86302ea1547f6f4c1621cda0eb7044479`. Driver uses the committed fixture entry and public commands only; no implementation, tests or fixture source inspected. Mode: hacking, acceptance encounter (not broad audit).

## Predictions before preparation

From the ticket, work-in-threads story and setup guide:

1. Owning new creates a git worktree, a durable canonical record and labelled `<id>.agent`; setup marker has one line before agent readiness. Guests in main/existing worktree do not own it; the no-setup project starts normally.
2. Inspect exposes exact pi session id/file and live pid, ownership and labelled terminals. Spawn/merge orders differ where guest ancestry and owning branch ancestry differ; unrelated free sessions are absent.
3. Fork gets a new persisted identity in its destination; promote preserves the existing identity and guest location. Promoting a live external pi leaves exactly one canonical writer, then resumes it after exit.
4. Quitting canonical pi changes pid but not session id/file; bootstrap prompt occurs once. Switching the record's current session redirects the next restart while immutable thread id remains unchanged.
5. Literal send does not interpret shell punctuation or append CR. History exposes the draft without submission; explicit CR submits it.
6. Auxiliary role is idempotent, cwd-bound and labelled. Cleanup removes only this owned fixture's resources; no shared service is touched.

Expectations 1–6 pending. Actions and observations follow below.

## Target / preparation

Deployment: disposable local git repositories, isolated XDG state/board/zmx, temporary auth symlink to normal local pi persona. Target must be freshly allocated by this worktree's committed `prepare`; the implementer's deleted target is not reused. Entry: `mise exec -- bun docs/attachments/thread-registry-and-zmx-launch/fixture.ts prepare`. No browser/auth UI required.

Guide discovery friction: `fixture.ts --help` errors with an argument usage message rather than help (no product resources opened). Guide supplies commands, so continue with those.

## Encounter sequence

- `mise run setup` exited 0; `prepare` allocated `/private/tmp/ab-thread-fixture-S5Yn4n` in this checkout, waited for canonical/fork/promoted idle, and printed ids. I used only this root. The temporary normal-persona auth symlink stayed inside its `agent` directory; no credentials are recorded.
- `inspect` showed six active threads, labelled zmx roles, one owner server, spawn depths 0→1→2→3 (owner→canonical→guest→fork) and merge fork directly under owner at depth 1. Free sessions were absent. `git worktree list --porcelain` matched main/owner/fork; `branch.owner.ab-parent=main`, `branch.fork.ab-parent=owner`. Owner and fork setup markers each had one line; none in main. No-setup shell reached READY. Header ids matched all recorded session ids; shell fixture sessions contained only the valid session header.
- Sent `literal $HOME ; 'quotes'` to owner. History showed the literal draft and no SUBMITTED line. Sent CR separately; history then showed `SUBMITTED:literal $HOME ; 'quotes'`.
- Sent Ctrl-D to canonical. Its pi pid changed 10982→57521, exact id/file remained `d051621c-a450-43ab-8fe7-28892059e38e`. Persisted user-message count was one, the original bootstrap prompt. Original report timestamp stayed unchanged; no new bootstrap submission.
- Started documented `external ROOT` under an owned POSIX PTY (not zmx) for this CLI-only encounter. `script` initially could not allocate from the harness's socket input (`tcgetattr/ioctl: Operation not supported on socket`); a stdlib `pty.openpty` relay running the same committed entry succeeded. External pi was pid 36292, id `01a0f71f-44e4-75e7-952c-61c786fe0532`; four live pi but only six listed threads before promotion. Promoted that exact id while live. Two seconds later there was one matching live pi, still 36292, guest in main, with its own registered `.agent` waiting. Ctrl-D through the external PTY exited it; three seconds later one matching pi, pid 61440, resumed the same id/file in zmx. This is sampled process/readLive evidence, not an exhaustive temporal concurrency audit.
- Sent fork `Reply only fork-report-ok. Do not use tools.` plus CR; its own snapshot acquired the fresh `fork-report-ok` report, while canonical's report remained `bootstrap-ok`. Fork's readLive subscriptions nevertheless retained canonical's thread/mail topics and lacked its own thread topic. Reporting held; wake routing is a recorded friction, not a demonstrated cross-wake.
- `switch ROOT CANONICAL` changed session to `01a0f720-31e6-71ce-ae3a-76fcad6eabdb`. Ctrl-D restarted pi as pid 92608 using this new file and id, while thread id remained `d051621c-a450-43ab-8fe7-28892059e38e`. New session had no user messages, and no stale bootstrap report was joined. Promoting the new current id returned the same thread; promoting the old immutable id rejected it with “fork it instead”, rather than replacing or duplicating the record.
- `attach ROOT CANONICAL` through the owned PTY changed zmx clients 0→1. Ctrl-\\ detached: clients 1→0, agent pid remained 92608. No native window or browser was opened; measurements use CLI/library outputs rather than a visual TUI review.
- Normal guest/no-setup READY lines used `thread/<their-id>` and blank run/handle, overriding this driver's inherited worker identity. Owner used `fixture/owner`, run=fixture, handle=owner.
- Existing regressions: `bun-axi test` = 167 passed / 2 skipped / 30 files. Initial `bunx tsc --noEmit` failed on missing Obsidian types after root setup. The ticket's documented frozen plugin install made the unchanged typecheck exit 0; no source repair.

## Expectation outcomes

1. Met: owner/guest/no-setup and one setup line per new declared-task worktree.
2. Met: exact joins, labelled inventory and distinct trees. Added expectation that forks wake only on their own thread: not met in subscription inventory (reporting itself held).
3. Met: fork new persisted identity; promote preserves external identity and guest location, waits then resumes (sampled evidence).
4. Met: same identity on restart, one bootstrap, and new current identity after switch.
5. Met: literal draft then explicit submission.
6. Partially observed: aux cwd/label and stability held; the guide has no independent ensure-role command, so repeated `ensureTerminal(server)` is unobservable through the documented fixture entry. Attach/detach preserved the pi. Cleanup pending below.

## Replayable checks for the reviewer

- C1: Prepare an isolated declared-setup project. Accept owner worktree/header/id and one marker line before pi readiness; guests in main/owner keep ownership=guest and do not add marker lines. Prepare no-setup project; accept READY without setup error.
- C2: Inspect owner→canonical guest→worktree guest→fork ancestry. Accept fork depth=3/treeParent=guest in spawn; depth=1/treeParent=owner in merge, matching git ab-parent; exact zmx names/labels and current live session/pid joins.
- C3: Once canonical idle, Ctrl-D then inspect. Accept changed pid, same id/file/header, exactly one persisted user bootstrap and no second report. Switch current session, Ctrl-D again; accept immutable thread id, new matching live session/header/file, no old membership or stale report; promoting current returns same record and old id rejects.
- C4: Launch `external ROOT` in a non-zmx PTY, wait for readLive idle. Accept free session excluded from list. Promote exact live id, repeatedly sample process/live records; accept exactly the external canonical writer until exit, then one runner child with unchanged id/file and guest ownership.
- C5: Send shell punctuation without CR. Accept byte-for-byte draft and no SUBMITTED before separate CR; accept exact SUBMITTED afterwards. History limit=8 must return no more than eight lines; plain history remains available.
- C6: Attach canonical, record clients=1 and pi pid, then detach with Ctrl-\\. Accept clients=0 with same pi alive. Independently repeat `ensureTerminal(server)` through the public library (not exposed in this fixture); accept one unchanged labelled terminal, user shell in thread cwd.
- C7: Fork canonical. Accept new id/file and report on its own `thread/<id>`. Inspect restored wake subscriptions; accept own topic and no inherited canonical thread/mail topics unless explicitly intended. Current recording fails that latter proposed check; no cross-wake stimulus was sent.
- C8: Cleanup owned fixture. Accept no isolated terminals, no active records, no fixture child/PTY relay/auth link or temporary worktree remains.

## Frictions / owners

- Fixture lacks `--help` and a documented headless PTY entry for external/attach: [[projects/mlegls-pi/issues/thread-fixture-help-and-headless-pty-entry]]. The setup commands themselves worked after PTY preparation.
- Fork wake subscription inventory retains its parent's topics: [[projects/mlegls-pi/issues/forked-thread-retains-parent-board-subscriptions]]. Fresh reporting was correct; no unsolicited wake was tested.
- Root setup still omits plugin typecheck dependencies: [[projects/mlegls-pi/issues/root-setup-still-omits-obsidian-typecheck-dependencies]]. Used its existing workaround.

No product repairs or tests authored. Unobserved contract details (atomic replacement, malformed-list failures, worker-handle ambiguity, branch-base override and launch failure cleanup) are not certified by this focused first-use replay; the ticket reviewer owns source/test coverage. The existing implementer evidence is not relabelled independent evidence.

## Cleanup / final result

`fixture.ts cleanup /private/tmp/ab-thread-fixture-S5Yn4n` exited 0 and printed `{"terminals":[],"activeThreads":[]}`. The root directory no longer exists, and process search by that root returned no matches. Both external and attach PTY wrappers had exited after Ctrl-D / detach. The failed-script FIFO keeper and its orphaned sleep were explicitly killed. No browser/native apps or shared services were opened/stopped. No fixture auth link or temporary git worktree remains.

Prediction 6 cleanup: met. Repeat-ensure remains unobservable via the guide, owned by this ticket's reviewer (C6), rather than accepted on the implementer's claim.

Focused outcome: owning/guest/no-setup, fork identity/reporting, trees/labels, restart/prompt, live promotion handover, literal send/history, current-session switching and CLI attach/detach held. No first-use story failed. Aux repeat-ensure was not independently replayed; wake subscriptions have a separate captured observation.

Evidence: [selected identity/state joins](driver-observations.json), [literal-input sequence](driver-literal.txt). This is a nonvisual library/CLI packet: the PTY was instrumented headlessly, not opened as a native UI or judged for rendered appearance.

## Review

Reviewed `dc9aa26` against the ticket and diff since `b7eeace`. Source read: registry, runtime, zmx, launch, agent-runner, sessions. No contract defect found; no behavior repaired.

- **C6 measured** (was unobservable through the fixture): the retained test calls public `ensureTerminal(owner, "server")` twice in an isolated `ZMX_DIR`; one `<id>.server` remains with the same shell pid and labels `thread=<id> role=server`, and `pwd` typed into it shows the thread cwd. Held.
- C1/C2/C5 replayed by the same test over shell fixtures: one setup line for the owning worktree and none added by a guest in it, `ab-parent=main`, spawn depths 0/1, terminal names, literal send without `SUBMITTED` until a separate CR, `history` limit. Ambiguous bare worker handle (edge-observations.txt) also retained. Leading-dash text sent through `zmx send` arrives literally.
- Left as evidence only: C3/C4/C7 (need a real pi persona/PTY; not deterministic in the suite), C8, attach/detach (needs a PTY).
- Fork wake subscriptions ([issue](../../issues/forked-thread-retains-parent-board-subscriptions.md)) stay filed; they sit in the board/session-meta wake path outside this ticket's files.
- Two-minute fix: `lib/thread/agent-runner.ts` child variable `process` shadowed the global; renamed `proc`.
- Checks on final head: `bun-axi test` 169 passed / 2 skipped / 31 files; `bunx tsc --noEmit` clean except the known Obsidian-plugin dependency errors ([workaround issue](../../issues/root-setup-still-omits-obsidian-typecheck-dependencies.md)); no tmux/workmux used; test zmx sessions and temp root removed.

