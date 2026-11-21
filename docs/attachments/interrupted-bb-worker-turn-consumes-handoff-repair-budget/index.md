# Interrupted BB worker turn: offline first use

The Concept worker's BB log pairs `provider/error` with `turn/completed` (`status: failed`) under the same turn ID at seq 1447–1448, 2663–2664, and 3730–3731. The error detail is `Pi run interrupted unexpectedly; no automatic resume was attempted` in all three pairs.

## Replay

From this checkout, run `bun lib/reconcile/setup-fixture.ts new`. The fixture runs the real reconciler, tracker, and Git worktree setup against a fake BB CLI. No account or provider is needed. Wait for `Ready. Retained target: …`, then set `root` to the printed `/tmp/rc-setup-*` path. The operator is the run owner `thr_solo`.

```sh
fx() { bun lib/reconcile/setup-fixture.ts "$@"; }
trap 'fx stop "$root"' EXIT
worktree=$(fx status "$root" | jq -r '.worker.path')
printf '/scratch.local\n' > "$worktree/.gitignore"
printf 'committed progress\n' > "$worktree/result"
git -C "$worktree" add .gitignore result
git -C "$worktree" commit -qm 'Checkpoint before interruption'
head=$(git -C "$worktree" rev-parse HEAD)
printf 'ignored progress\n' > "$worktree/scratch.local"
checkpoint=$(printf 'checkpoint\n\n\140\140\140yaml\ncommit: %s\n\140\140\140' "$head")
err='Pi run interrupted unexpectedly; no automatic resume was attempted'
fx turn "$root" "$checkpoint"
```

Check `fx status "$root"` after each action, waiting for its reply or exception before submitting another turn. Status reports the current worker ID and checkout, retry counts, and delivered tells.

1. `fx turn "$root" ''` completes a turn with an empty handoff. It should get the empty-report nudge and set `retries.status` to `1`.
2. `fx fail "$root" "$err"` logs the error and failed completion under the same turn ID. It should tell the same worker to continue from its last checkpoint and name the checkout, HEAD, and error. Check the committed `result` and ignored `scratch.local` are still there. The interruption count should be `1`; the status count should still be `1`.
3. Submit `fx turn "$root" "$checkpoint"` again, wait for its acknowledgement, then repeat the interruption. The same worker should get a second recovery prompt. Acknowledge again with the checkpoint before injecting the third failure.
4. The third failure should raise `worker turn interrupted: after 2 recovery attempts`. Read the owner tell and `exceptions.solo.text`: both should show the original BB error and preserved checkout and HEAD. The status retry count should still be `1`. Run `fx stop "$root"` to remove the fixture if not using the shell trap.

## Implementation encounter

On `6a08bce0`, the new fixture reached `solo-implement-1` on fake BB worker `bbt-4ac06620`. The completed empty report produced the status nudge. Both interrupted turns continued the same worker at checkpoint `b7102539`, with ignored state intact, and neither changed the status count. The third interruption notified the owner with the original error, checkout path, and checkpoint SHA; the worker and ignored state were still present until fixture cleanup. No live BB interruption was induced.

`bun test lib/thread/turn.test.ts lib/reconcile/resume.test.ts lib/reconcile/setup.test.ts`: 11 passed. `bun run typecheck` passed.
