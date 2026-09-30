# ab resource-list drive

## Predictions (before opening product)

From the ticket and README, as a CLI user I expect:

1. `ab check list` returns a complete JSON array even with many historical checks; piping to `jq length` or Python `json.load` succeeds rather than stopping at 65536 bytes. I should be able to inspect the queue without parsing partial objects.
2. Each check receipt includes id, kind, status, command, cwd, times, code, reason and log (where applicable), not `env` or its values. A deliberately supplied environment value should not appear in the list.
3. `ab check list --status running,queued` returns only those statuses, with an empty array if neither exists. Filtering should avoid scanning a full historical list downstream.
4. `ab service list` has the same compact JSON shape, environment omission and status filter. Starting my own foreground service should make a filter for `running` find it, then stopping it should move it out of that filter.
5. README says an existing daemon needs a safe restart to use the current version. Setup handoff is null, so checkout ownership and entry point remain to establish before driving; I must not mistake the globally installed `ab` or an inherited daemon for this checkout's product.

## Setup and encounter

Pending. Predictions above were recorded before any product invocation.

## Frictions, expectations and replayable checks

Pending drive.
