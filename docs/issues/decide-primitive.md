---
next: implement
part-of: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
---

`decide(state, questions) → {[q]: {choice, p, dist}}` in `lib/`, jev-backed, with two fallbacks selectable per call: a logprob-capable cheap model, and `ask` (bounce to the parent model as a tool result, or to the human as `needs-input`). thresholds live in the caller, never in the backend; calibration is the point. low confidence maps onto the existing `needs-input` tag: selective prediction with a reject option.

done: the function exists with a test against jev, the fallbacks work, and "[[projects/mlegls-pi/issues/dispatch-script]]" can call it. jev access is already granted.

holes:
- the ask fallback mid-script: does the script suspend across the parent's turn (the async wake/block primitive), or does it fail and re-run? decide with "[[projects/mlegls-pi/issues/supervision-join-script]]".
- how conversation tail is serialized as jev `state` for in-session calls; the same serialization serves "[[projects/mlegls-pi/issues/ingress-filter]]".
