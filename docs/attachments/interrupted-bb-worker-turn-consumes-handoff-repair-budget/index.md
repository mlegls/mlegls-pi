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

## Independent drive: predictions before first use

- A completed empty handoff asks for a status repair and consumes one status retry.
- The first two failed turns ask the same worker to continue from its checkpoint; the checkout, commit and ignored work survive, and the status count stays at one.
- The third failed turn holds for the owner with the actual BB error and the preserved checkout and HEAD. The status count still stays at one.

## Independent drive: observations

Tested `28e918b5` twice through the replay above as `thr_solo`, with the local fake BB fixture. Both launches reached `Ready. Retained target`; both were stopped and removed. No live BB interruption was induced.

| Check | Observation | Verdict |
| --- | --- | --- |
| Complete an empty turn after the checkpoint. Wait for a status repair. | The worker received `First nonblank line: (empty report)`; `retries.status` became `1`. | Met |
| Fail a turn, wait for the interruption prompt, and acknowledge with a checkpoint. Repeat once. Compare worker ID, checkout, HEAD, and ignored state after each failure. | The same `solo-implement-1` worker (`bbt-d41cc4cb` on the second run) received both prompts. Each named the checkout, HEAD and original error and asked it to continue from the last checkpoint. The status count stayed at `1`; the interruption count advanced from `1` to `2`. The checkpoint and ignored file survived both failures. | Met |
| Fail a third turn. Wait for both the hold and the owner tell. | `exceptions.solo.reason` was `worker turn interrupted: after 2 recovery attempts`. The exception and the delivered `thr_solo` tell both named the same worker, checkout and HEAD and included `Pi run interrupted unexpectedly; no automatic resume was attempted`. The status count stayed at `1`; the worker, checkpoint and ignored file remained available. | Met |

The immediate snapshot after submission can still show the prior turn. On the first run, the snapshot with the third-turn exception still showed only the startup tell for the owner. The second run waited separately for the exception and the new `thr_solo` tell via `fx status`; both arrived. When replaying, use the delivered tell as the check for owner notification, since the exception alone shows only the hold.

## Implementation encounter

On `6a08bce0`, the new fixture reached `solo-implement-1` on fake BB worker `bbt-4ac06620`. The completed empty report produced the status nudge. Both interrupted turns continued the same worker at checkpoint `b7102539`, with ignored state intact, and neither changed the status count. The third interruption notified the owner with the original error, checkout path, and checkpoint SHA; the worker and ignored state were still present until fixture cleanup. No live BB interruption was induced.

`bun test lib/thread/turn.test.ts lib/reconcile/resume.test.ts lib/reconcile/setup.test.ts`: 11 passed. `bun run typecheck` passed.
