# Tool argument papercuts — independent drive

## Before-use predictions

- Fragment edit: using `oldText`/`newText` will replace uniquely matched text just as `old`/`new` do; each alias should work independently.
- Read: existing and missing paths together will return existing content plus `not found: <path>`. A lone missing path will still fail.
- Grep: mixed existing/missing roots will preserve matching output plus an inline missing-path diagnostic. A lone missing root will fail.
- Tracker: `show tool-argument-papercuts-cost-a-turn-each` will return the same issue as `text`.

## Setup and readiness

Local Bun library and tracker CLI; no auth, services, or persistent seed. Driver-owned checkout `/home/mlegls/dev/mlegls-pi__worktrees/tool-argument-papercuts-cost-a-turn-each-drive-2`, revision `43866c6cab8357910e01392df5de651c99c7f50d`. Implementer named their checkout in setup; commands here ran on the driver's inherited implementation revision instead. Bun 1.4.4 imported the public library modules successfully; tracker CLI answered successfully. No services required. No source, tests, or fixtures inspected; supplied unit-test command deliberately not run.

## Encounter and outcomes

All four predictions met through library/CLI surfaces; no rendered UI.

| Claim | Action | Observed result |
| --- | --- | --- |
| Edit aliases | Register `registerFragmentEditTool`, prepare arguments through its public `prepareArguments`, then execute against a temporary `sample.txt` containing `alpha\n`. Try `{oldText: 'alpha', new: 'beta'}`, `{old: 'alpha', newText: 'beta'}`, and both aliases. | All three normalized to canonical `old`/`new`, returned `sample.txt: 1 edit at 1 (1 → 1 lines)`, and disk contents became `beta\n`. |
| Partial read | Register `registerReadTool`; execute with `path: 'README.md nonexistent-drive'`. | Existing README content returned followed by `not found: nonexistent-drive`; structured content also retained both. |
| Lone read missing | Execute with `path: 'nonexistent-drive'`. | Rejected with ENOENT naming the missing path. |
| Partial grep | Register `registerGrepTool`; execute `{path: 'README.md nonexistent-drive', pattern: 'pi', limit: 2}`. | Returned `not found: nonexistent-drive`, README matches at lines 1 and 3, and the two-match limit notice. |
| Lone grep missing | Execute `{path: 'nonexistent-drive', pattern: 'pi'}`. | Rejected with `Error: not found: nonexistent-drive`. |
| Tracker alias | Run `bun skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts show tool-argument-papercuts-cost-a-turn-each` and the same command with `text`. | Both exited 0; stdout was byte-identical. |

Library setup captured registered tool definitions with `{registerTool: t => tools[t.name] = t}`. Read/grep dependencies were `{plain: true, ledger: new Ledger(), persist: () => {}, sources: []}`, using the exported `Ledger` from `lib/outline-read/ledger.ts`. Fragment dependencies were `{sources: []}`. Calls used `execute('drive', args, undefined, undefined, {cwd: process.cwd()})`; fragment passed its temporary directory as cwd. The no-op persist callback avoids session persistence in this standalone embedding. Temporary files were removed in `finally`.

## Expectations and replayable checks

1. Each edit alias independently and together should preserve the replacement: repeat the three argument pairs above against a fresh `alpha\n`; accept only `beta\n` on disk after preparation and execution.
2. Mixed read should preserve content and diagnostic in a successful result: repeat the exact path pair above; accept README text and `not found: nonexistent-drive` together.
3. Mixed grep should preserve matches and diagnostic: repeat the exact grep arguments above; accept README match lines plus the missing-path diagnostic together.
4. Single-path read and grep should remain errors: replay each lone missing path; accept rejection naming the missing path.
5. Tracker aliases should be interchangeable: compare exit status and stdout of the exact commands above; accept exit 0 and byte-identical output.

## Frictions and limits

- The supplied entry point was a unit-test command, rather than a standalone library-use recipe. Public registration exports were discoverable via dynamic import keys, but embedding initially failed until supplying ledger, persist and sources dependencies. These were setup mistakes in the driver's ad hoc embedding, not failures of the changed behavior.
- Calling fragment `execute` directly bypasses argument preparation: `oldText` then fails, and `newText` alone can insert `undefined`. Re-driving through the exposed preparation lifecycle succeeded in every alias case. This packet establishes the normal preparation lifecycle, not raw unprepared execution.
- Anchor-based `registerEditTool` exposes no preparation hook and documents string hunks rather than fragment-object aliases. No additional anchor-edit behavior is claimed here.
- Test coverage itself was not inspected or run: reviewer owns that acceptance check. No persistent deployment or background process was started.

## Review

Read the diff of 43866c6c against the ticket. Ran `bun test lib/outline-read skills/enabled/all/mlegls/conventions/tracker/scripts/issues.test.ts` at the review head: 77 pass, 0 fail. Tests cover each alias (including canonical fields winning over aliases), mixed existing/missing read and grep, lone-missing read and grep rejection, and `show` = `text`. Non-ENOENT/ENOTDIR stat errors still throw; single-path calls keep their error. No defects found, no repairs, no new frictions to file. The desk changes in the merged range belong to another ticket.
