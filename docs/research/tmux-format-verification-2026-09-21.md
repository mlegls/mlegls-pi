# tmux metadata verification — 2026-09-21

Want: terminal users can keep stable IDs, observe command exits, wait for terminals, and receive output/exit alerts.

## Cause and change

On the installed tmux 3.7b, both display-message and list-panes replace literal tabs in format output with underscores. Reproduced on a dedicated server started with `-f /dev/null`, excluding user configuration and BB module gating. The parser consequently treated the entire metadata row as its ID and lost exit status and alert configuration.

Changed the summary separator in `lib/session/tmux.ts` to printable `|`. Names are constrained and metadata is base64url. The unconstrained current-command field is last, and the parser rejoins its remaining segments so a command containing `|` is preserved. No persisted metadata format changed.

## Verification

- Existing session tests: 17 pass, 0 fail, both with and without BB_THREAD_ID. Covers shell state, stable IDs, output, exit status, wait-any/all, control keys, and restored/output/exit alerts.
- Full suite: `env -u BB_THREAD_ID bun test` — 203 pass, 2 skip, 0 fail (205 tests). No inter-test errors. The separate board-under-BB test-environment mismatch remains outside this change.
- Typecheck and diff whitespace check pass. No tests added or changed.
- Live importing-client probe: spawned `printf ready; exit 7` with both alert types; snapshot and list returned ID `probe`, status `exited`, exitCode 7, decoded metadata and both armed alerts; snapshot output was `ready`. Cleaned up the probe afterward. No story files exist in docs/stories.
- SCC against starting ref fc8a27e5df51c038124c44020db5b149a886b2a2, scoped to lib/session/tmux.ts: code 383 → 383, complexity 138 → 138.

The full suite ran against the current working tree, which also contains unrelated concurrent autoread edits; those edits were preserved and are not part of this fix. Existing hosts retain imported code: reload/restart Pi to use the fix in host-owned terminals.
