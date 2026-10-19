# Desk independent drive

Tested revision: `5d279dbf9b62a90ede3dc891ff114d71e2d9600a`.

## Predictions recorded before first use
1. From a disposable linked worktree, path and mutations target its main checkout desk; first write creates files and git exclude entry. **Met.**
2. Supervisor and other roles, working text, and attention items can be set/cleared; repeating a title replaces one item. **Met.**
3. Writes clean both files of archived/deleted owners and preserve live owners. **Met** for the sampled working-set write and documented cleanup surface.
4. CLI help and documented module calls work without installed links. **Met.**
5. Universal/tend/supervise/shape instructions designate desk for writes. **Met.**

## Setup and ownership
Local CLI/module, no server/browser. Supplied `mise run setup` completion was confirmed by notification. Existing bb daemon and current `BB_THREAD_ID` (`thr_887di6tzts`), no credentials created. `./bin/ab desk --help` responded with all mutation commands. Owned disposable target `/tmp/desk-drive-pUQiux/main`, linked worker `/tmp/desk-drive-pUQiux/worker`, prepared using the guide's git-init/empty-commit/worktree-add recipe. No shared project desk was changed.

## Actions and observations
- Ran checkout `bin/desk` from disposable worker. `path` and all mutations returned `/private/tmp/desk-drive-pUQiux/main/desk` (macOS canonical path). Set supervisor/tester, set working text, added attention from stdin and repeated same title with replacement body. ROLES showed both roles and working line with current owner; ATTENTION showed exactly one `## Drive question`, current owner, and replacement body.
- Main `.git/info/exclude` contained `/desk/`; `git status --porcelain` was empty and `git check-ignore desk/ROLES.md desk/ATTENTION.md` returned both paths.
- Prepared convention-file state with live owner above, actual archived owner `thr_rsj9av6t4c` (confirmed via `bb thread list --archived --json`), and nonexistent owner `thr_nonexistent_desk_drive`. No thread was archived/deleted for this trial. Working-set mutation removed archived role, nonexistent working line, and both stale attention items while preserving live supervisor and live attention body. Nonexistent owner exercises missing/deleted lookup semantics, not a newly deleted real thread.
- Through documented module imports from `./lib/desk`, called deskPath, setRole, setWorking, addAttention, removeAttention, clearWorking, clearRole, cleanDesk with the disposable worker cwd. All eight calls succeeded and returned the same main desk path.
- CLI attention remove, supervisor/tester role clears and working clear left exactly `# Roles` and `# Attention`. All CLI actions exited zero.
- Read only user-facing instruction excerpts: `agent-prompts/universal.md`, `skills/enabled/all/mlegls/orchestrations/{tend,supervise}/SKILL.md`, `skills/enabled/all/mlegls/lifecycle/shape/SKILL.md`. All explicitly name `ab desk` for convention writes.

## Replayable checks
1. Follow `docs/guide/desk.md` safe first-use recipe. Run path, role set supervisor/tester, working set, attention add with stdin twice under same title. Accept main-owned path, both roles plus working owner, and one heading containing only replacement body; git check-ignore must identify both files.
2. Seed the documented convention format with a live, archived and nonexistent thread owner in both files. Run working set. Accept only live-owner lines/items remaining in both files. This sampled trigger demonstrates cross-file cleanup, not an exhaustive mutation matrix.
3. Run the guide's module calls with explicit disposable cwd and current live thread ID. Accept successful calls returning the shared desk path. Run CLI clears/removes; accept heading-only files.
4. Read the four named instructions and locate the helper write guidance. Accept explicit `ab desk` commands in all four.

## Frictions and limits
No product friction observed. No rendered UI; no screenshots. Archived status was real; nonexistent identity represents deleted-owner behavior without altering any existing thread. No concurrency stress or failed-daemon simulation was attempted; these are not additional ticket stories. Disposable repository removed after encounter; no processes or deployments left running.

## Outcomes
All four ticket claims held through the CLI/module/documentation surfaces above.
