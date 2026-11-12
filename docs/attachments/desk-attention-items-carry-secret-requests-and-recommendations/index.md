# Desk attention item first use

## Predictions recorded before first use

- **Met:** An ordinary decision request retains its body and standalone `Recommended:` line beneath an owner heading.
- **Met:** Two `--secret` flags plus an absolute `--write-env` produce two `Secret: NAME → PATH: DESCRIPTION` lines immediately beneath `Owner:`, without creating a credentials file or blocking for input.
- **Met:** Repeating a title replaces that owner's item; removal leaves other items intact and eventually clears both requests.
- **Met:** Missing or relative secret destinations are rejected without changing the desk.

## Setup and readiness

CLI-only encounter at revision `98ba3c392b641af33ebb8cbb4cc5440e5ae6d5a2`. Following [the disposable setup](../../guide/desk.md#safe-first-use-setup), this worker created `/tmp/desk-drive-4.izT5KG/main` and its linked `worker` checkout. Helper: this checkout's absolute `bin/desk` path. Persona: existing live `BB_THREAD_ID` (`thr_jthqvrxzfs`), no credentials required. `./bin/desk --help` returned successfully and advertised repeatable secrets and the absolute destination. The first working-line write returned the fixture's main desk path, confirming daemon access and target ownership. No servers or browser sessions were started.

## Encounter and replayable checks

1. From the disposable linked worktree, run the guide's working-line and ordinary decision-item commands. Inspect `main/desk/ATTENTION.md`. Observed one title, owner, complete body and `Recommended: Use staging.` on its own line. **Held.**
2. Run the guide's two-variable credential request. Both invocations return immediately with the shared desk path. Inspect the file: immediately below the owner were:

   ```text
   Secret: SERVICE_TOKEN → /tmp/desk-drive-4.izT5KG/main/credentials.env: Token for the service
   Secret: SERVICE_ACCOUNT → /tmp/desk-drive-4.izT5KG/main/credentials.env: Account identifier
   ```

   The ordinary decision and credential body both remained. `test ! -e "$fixture/main/credentials.env"` succeeded. **Held:** filing describes the request without writing values or waiting for a credential form.
3. Repeat `attention add "Choose the deployment target" --file -` with body `Replacement choice.` and `Recommended: Use production.`. Inspect the file. Exactly one matching title remained, with the new body; the credential item remained unchanged. **Held.**
4. Submit `attention add Invalid --file - --secret 'TOKEN=Token'` without a destination. Exit 1: `--secret requires --write-env /absolute/path`. Repeat with `--write-env relative.env`. Exit 1: `--write-env must be an absolute path`. Compare `git hash-object` for ATTENTION.md before and after both attempts: identical. **Held.**
5. Remove the ordinary item. Inspect the file: credential request remained intact. Remove the credential request and clear the working line. Inspect both files: only `# Attention` and `# Roles` remained. **Held.**

## Frictions and scope

No unresolved friction encountered. All four predictions were met. The guide explains desk requests for sessions that must keep working versus `bb secret request` for turn-blocking forms. This packet verifies the CLI item-format slice; the parent owns combined Attention-panel first use, writing supplied values and notifying the owner. No rendered journey occurred (`visual: false`, no screenshots).

## Cleanup and reusable entry point

The disposable fixture was removed after inspection. No external resources remain. Run `./bin/desk --help` from the checkout, then follow the guide's disposable setup. With `helper` pointing at this checkout's helper and `fixture` at the disposable repository root:

```sh
printf '%s\n' 'Service access expired.' |
  "$helper" attention add "Renew service access" --file - \
    --secret 'SERVICE_TOKEN=Token for the service' \
    --secret 'SERVICE_ACCOUNT=Account identifier' \
    --write-env "$fixture/main/credentials.env"
```
