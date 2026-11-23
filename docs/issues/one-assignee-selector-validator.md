---
stage: "done"
assignee: "agent"
priority: 3
author: "session:01a20657-0e8d-726c-98b9-a4f79a5a23fc"
---
Found in the 2026-11-23 audit of the supervision/issue orchestration system (@thread:thr_3pkhxrd57p). Four incompatible `assignee` validators:

- vault: `validAssignee` in [issues.ts](../../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts)
- GitHub: [tracker-github-write.ts:115](../../lib/tracker-github-write.ts) (agent, human, `user:`)
- dispatch: [dispatch.ts:72](../../lib/dispatch.ts)
- Obsidian: [model.ts:90](../../extensions/obsidian-tracker/model.ts)

The [lifecycle](../../skills/enabled/all/mlegls/conventions/tracker/references/lifecycle.md) defines the selector grammar once. Done when all four call one parser of that grammar, and a backend that can't represent a selector (GitHub labels) says so by name rather than "unsupported assignee selector".

## Result

done

All four stories hold on 849d9eef. The vault CLI, GitHub read and write, dispatch and Obsidian all call `parseAssignee` in `lib/assignee.ts`. A search finds no other selector regex left, so the story the driver marked unobservable ("all four callers use one parser") holds in code review.

- **Friction fixed:** the driver found that error messages named the field but not the rule. Vault, GitHub and dispatch now quote the rejected value and add the grammar (`ASSIGNEE_GRAMMAR`). Obsidian's error still just says "invalid assignee".
- **Readback added:** `first-use.ts` now reads the issue again after a refused update. I re-ran all five selectors: each refusal reads back `agent`, and the rest of the table is unchanged.
- **Stricter effort:** effort must now be one of the six named levels; the old check took any lowercase word. No mlegls-pi issue has a `model:` pin, so nothing stored there becomes invalid. Concept's lint timed out after 300 s, so its stored selectors weren't checked against the new grammar.
- **Tests:** the five affected test files pass (58 pass, 1 skip).

```yaml
commit: "849d9eef"
stories:
  - {story: "A stance and model override are accepted in either order.", outcome: held}
  - {story: "Unknown effort and duplicate stance are rejected across all four surfaces.", outcome: held}
  - {story: "GitHub names the session selector it cannot represent.", outcome: held}
  - {story: "All four callers use one parser.", outcome: held}
evidence: {path: "docs/attachments/one-assignee-selector-validator/index.md", visual: false, shots: []}
tests: []
fixed:
  - "e9904f63: invalid-assignee errors in vault, GitHub and dispatch quote the value and add the selector grammar (driver friction)"
filed: []
caveats:
  - "Behaviour change: effort is now limited to none|minimal|low|medium|high|xhigh, where the old check took any lowercase word. mlegls-pi has no model: pins; concept's lint timed out, so its stored selectors were not checked."
  - "GitHub read: a stored session: selector or a malformed one now reads as no assignee. A malformed pin used to fall back to the plain agent/human label."
  - "Diff since base also contains sibling merges (report parser, Obsidian typecheck); this review covered only the assignee commits."
```

Evidence: [docs/attachments/one-assignee-selector-validator/index.md](../attachments/one-assignee-selector-validator/index.md)
