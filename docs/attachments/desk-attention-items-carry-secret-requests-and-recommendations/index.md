# Desk credential item first use

Implementation first use at `318f6f39e0ac5422b565454638ca785d2149e407`, from base `5ff9479d3efec61888c68ec23ba30a3369bc21a0`. CLI-only; the combined Attention panel encounter belongs to the parent after both implementations land.

## Setup and replay

Use the [desk guide's disposable setup](../../guide/desk.md#safe-first-use-setup). It runs this checkout's `bin/desk` from a separate git worktree, using the caller's live `BB_THREAD_ID` (or explicit `--thread ID`) and the existing bb daemon. No credentials or new bb threads are needed. The fixture's main checkout owns its desk; no project desk is modified.

The observed fixture was `/tmp/desk-credentials-first-use.pxilr5`, owned by this worker, with owner `thr_vthazfa4ce`. It was removed after the trial. The guide recreates the starting state, including both example items; pause before its removal commands to inspect or use the items.

## Observed

- Added an ordinary question with options and its own `Recommended:` line. Added a second item with two `--secret` arguments and an absolute `--write-env` destination. Both were present in the main fixture's `desk/ATTENTION.md`; no dotenv file was created.
- The credential item's metadata was directly below `Owner:`, with no blank line between variables:

  ```text
  Owner: @thread:thr_vthazfa4ce
  Secret: SERVICE_TOKEN → /tmp/desk-credentials-first-use.pxilr5/main/credentials.env: Token for the service
  Secret: SERVICE_ACCOUNT → /tmp/desk-credentials-first-use.pxilr5/main/credentials.env: Account identifier
  ```

- Re-filed `Choose the deployment target` under the same owner with `Replacement question.` and `Recommended: Keep staging.`. Reading the file showed one copy of that title with the replacement body; the credential item remained intact.
- Tried missing `--write-env`, relative `.env`, `BAD-NAME=Token`, and `TOKEN=`. Each exited nonzero, respectively reporting the required destination, absolute-path requirement, invalid variable name and nonempty single-line description. The file still contained only the two valid items.
- Removed both items and cleared the working line. Reading the files showed only `# Attention` and `# Roles`.
- `bun run typecheck` passed. No existing tests directly cover `addAttention` or the desk CLI; no permanent tests were added.

This establishes the helper's item format and replacement/removal first use. It does not establish browser rendering, secret submission or owner-message delivery; those are the parent's combined trial.
