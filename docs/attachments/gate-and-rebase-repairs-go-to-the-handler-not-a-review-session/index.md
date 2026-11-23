# First drive: landing repairs

## Predictions before first use

- `conflict`: a reviewed node hits a rebase conflict. A handler receives the failure and reviewed head, spends one repair attempt, and a conflict-only fix lands without a replacement reviewer.
- `format`: a gate fails on formatting already wrong on main. The handler leaves a separate format commit on the target; the reviewed node rebases onto it and lands without a replacement reviewer.
- `code-repair`: a landing failure goes to the handler first. If the handler changes code inside the reviewed diff, another reviewer sees that new head before it lands.

## Setup and replay

Tested `3f6a92327f9be324633c266a72d9133eca6abca5`. `mise run setup` succeeded. Ran the three modes below in this checkout, using the handoff's disposable local Git repositories and fake BB registry, with no live service or credentials. Each mode reached the reconciler and exited 0.

```sh
for mode in conflict format code-repair; do
  PI_RECONCILE_TICK_MS=100 bun docs/attachments/probe-conflicts-and-prepare-deps-around-integrate/fixture.ts "$mode"
done
```

## Observations and replay checks

| Mode | Observed | Accept on replay |
| --- | --- | --- |
| `conflict` | Handler 1 received the reviewed head and the conflict in `conflict.txt`. Reconciler reported that the handler preserved the reviewed change, retried integration, and landed the settled SHA on the target. No reviewer notified or launched. | One handler, zero new reviews; `landed` and `settledOnTarget` true. |
| `format` | The failed gate tail named `inherited.js`. Handler started at the pinned target, and its separate commit touched only `inherited.js`. The final target moved beyond that commit, still containing it, and the reconciler reported the node landed. Gate order was `gate → setup → gate`, with one handler and zero new reviews. | The handler starts at the original target SHA; the formatting commit is on the final target; the node lands after a second gate and no new review. |
| `code-repair` | The failure was a conflict. Handler 1 settled with changed reviewed code; `fixture-review-2` launched at exactly the handler's settled SHA. Target was unchanged. | One handler and one review; `reviewHead` equals `settled`, `landed` false, target before and after identical. |

The three routing predictions held. `code-repair` stops at review dispatch, so this does not demonstrate a subsequent approved landing. One handler launch was observed per mode; the replay output does not expose the repair-budget debit. The entry point does not exercise lint, an untouched-line typecheck failure, or a second node sharing the same target formatting defect. The registry reports `stance/handler`; no live Sol request was made.

No interaction friction prevented the drive. The receipt's `done` field remained false even for the two landed modes, so landing was judged from the landing event and target receipt, not ticket closure. No servers or external services were started.
