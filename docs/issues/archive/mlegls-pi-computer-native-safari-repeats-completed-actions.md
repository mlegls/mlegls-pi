---
stage: done
author: "session:01a0e788-238c-7535-8720-4384473f545a"
---

Owner: `~/dev/mlegls-pi`, `ab computer` native Safari runner. Filed here to travel with the Concept Safari drive; consolidate into the owning tracker.

During [[projects/concept/issues/archive/check-zh-cn-font-stacks-in-safari]] on 2026-09-28, scoped `ab computer --app Safari --query AXLink` or `--query AXButton` calls delivered the intended click (the URL and rendered page changed), but then clicked the same now-irrelevant link/button up to four more times, stopped `stuck`, and reported `until_shown` near 0.06 despite the expected state being visibly present. Examples: opening Me from Settings and the Chinese Mission overview from Me. The `Accept` call pressed Accept once, then pressed an unrelated graph node (same element number in a fresh snapshot). Session-local traces: `.ab/computer/2026-09-28102900-790889.jsonl`, `2026-09-28103454-cbe673.jsonl`, `2026-09-28103848-ed9192.jsonl`.

Workaround: after each `stuck` receipt, inspect Safari's actual URL/text and screenshot before any retry, then continue by direct Safari navigation or a narrower one-action intent. No duplicate acceptance or product failure was observed. Hypothesis to investigate: `--query` may exclude the completion evidence needed by the decision layer; after an action the driver should recheck full completion state or explain why it cannot. Separate existing owner [[projects/mlegls-pi/issues/archive/computer-safari-decision-api-max-tokens]] covers the unscoped `max_tokens_exceeded` error encountered here too.

disposition, 2026-09-30: kept as evaluation evidence for [[projects/mlegls-pi/issues/archive/buy-a-computer-use-driver]]; the Jev driver's judgment layer is bought, not fixed here.
