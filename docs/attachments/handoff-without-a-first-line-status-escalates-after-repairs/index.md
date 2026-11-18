# Reconciler handoff drive

## Predictions before first use

As the fake worker in the local offline reconciler fixture, I expect `status: done` in a YAML block after ordinary prose to advance the worker without a repair. I expect the same if the YAML fence is the first line. If status is omitted, or the YAML offers conflicting statuses, I expect the current worker to receive a repair nudge quoting my first line rather than advance.

## Setup and replay

Tested `adb74484`. From this checkout, run `bun lib/reconcile/setup-fixture.ts new` separately for each case. Each invocation printed `Ready` and started a fake implement worker in `implement` with no exceptions. It created a fresh temporary Git target under `/tmp/rc-setup-*`; no live services or authentication. I submitted each report as the fake implement worker using `bun lib/reconcile/setup-fixture.ts turn "$ROOT" "$BODY"`, then ran `bun lib/reconcile/setup-fixture.ts status "$ROOT"`. The immediate response and first status read sometimes still showed `implement` with no messages. Wait for a phase change or repair tell before judging; a status read two seconds later showed the outcomes below. I ran `bun lib/reconcile/setup-fixture.ts stop "$ROOT"` on every target.

## Checks and outcomes

Use `setup: {entry: bun app.ts}` in the first YAML block for each case. A held acceptance transitions to `drive`, preserves that entry in the new worker prompt and sends no status repair. A held rejection stays in `implement`, increments the status repair count to 1 and quotes the exact rejected line in the worker tell.

| Report body | Observed result | Prediction |
| --- | --- | --- |
| `Here is the handoff.` then a fenced YAML block containing `status: done` | Entered `drive` with `bun app.ts` in the new prompt and no repair. | Met |
| Same YAML block with the opening fence on the very first line | Entered `drive` with `bun app.ts` in the new prompt and no repair. | Met |
| `Here is the handoff without status.` then the block with `setup` only | Stayed in `implement`; `status: 1`; tell included `First nonblank line: "Here is the handoff without status."`. | Met |
| `Here is the handoff with duplicate status keys.` then one block containing `status: done` and `status: blocked` on successive lines | Stayed in `implement`; `status: 1`; tell quoted the first line and reported `Map keys must be unique`. | Met |
| `Here is the handoff with conflicting statuses.` then a fenced YAML block containing `status: done` and `setup`, then a second fenced YAML block containing `status: blocked` | Entered `drive` with the first block's setup and no repair. The conflict was not surfaced across fences. | Not met |

## Review replay

On `e306458c`, the last row now holds. With the same two blocks and first line, the worker stayed in `implement` with `status: 1`, no exception, and a tell quoting `"Here is the handoff with conflicting statuses."` followed by `conflicting report statuses: done, blocked`. The first block still supplies the handoff fields when statuses agree.

The other four rows still hold. The duplicate-key CLI replay quoted the submitted line and reported `Map keys must be unique`; the retained reconciler check exercised both accepted reports and the missing-status repair. The three affected test files passed (21 tests total). Fixture targets were stopped. The submission CLI now labels the immediate snapshot and points to `status ROOT` for the reconciler outcome.
