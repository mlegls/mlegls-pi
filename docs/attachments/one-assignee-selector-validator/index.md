# Assignee selector first use

Tested revision: `925b410b`. The supplied CLI replay seeds a disposable vault and fake GitHub issue, both initially assigned to `agent`. No auth; dispatch is preflight only.

## Predictions before first use

- A model override at `high` combined with `agent:auto-routine` should persist in both trackers and pass dispatch syntax validation. Reversing the components should still work.
- A `session:` selector should persist in the vault. GitHub should refuse it with a message naming GitHub and `session`, leaving the original assignee intact. Dispatch may have to locate the named session after accepting the syntax.
- Unknown effort `turbo` and a repeated stance should be rejected at each entry point without changing stored assignment.
- If the replay offers an Obsidian surface, its assignment editor should make the same syntax decisions as the vault CLI.

## Drive and replay checks

Run `bun docs/attachments/one-assignee-selector-validator/first-use.ts` with no argument for stance-first, or append one quoted selector from the table. Each of the five commands exited zero. Both seeded issues read back as `agent` before each attempted update. The Obsidian evidence is from its model surface, not a rendered editor.

| Selector | Vault CLI | Fake GitHub tracker | Obsidian model | Dispatch |
| --- | --- | --- | --- | --- |
| `agent:auto-routine, model:fixture/example:high` (default) | Saved verbatim | Saved verbatim | Valid, on frontier | Preflight accepted; 1 pending, slot occupied |
| `model:fixture/example:high, agent:auto-routine` | Saved verbatim | Saved verbatim | Valid, on frontier | Same preflight result |
| `session:fixture-session` | Saved verbatim | `GitHub labels cannot represent the session selector session:fixture-session` | Valid, off frontier | `example is assigned to session:fixture-session` |
| `model:fixture/example:turbo` | Invalid assignee selector | Invalid assignee selector | Invalid, off frontier | Invalid assignee, echoes input |
| `agent:auto-routine, agent:auto-routine` | Invalid assignee selector | Invalid assignee selector | Invalid, off frontier | Invalid assignee, echoes input |

Both orders worked as predicted, and both invalid cases were rejected across all four surfaces. The session selector received the expected capability diagnostic from GitHub. Dispatch refused on assignment eligibility rather than syntax; the setup does not include a matching session. No workers were launched.

## Friction and limits

No blocking friction in the prepared CLI journey. On malformed input the tracker diagnostic identifies the field but leaves the caller to consult the grammar for the allowed efforts or combination rules.

The replay reports the refusals without a post-rejection readback. To verify the unchanged-state prediction, repeat each rejected update in a disposable tracker seeded with `assignee: agent`, then read the same issue again and require `agent`. The table checks observable agreement; whether the four callers use one parser is a code-review check.

## Review (one-assignee-selector-validator-review-3)

Code review: the vault CLI (`issues.ts` parse, frontier eligibility and human selection), GitHub write (`assigneeRole`) and read (`tracker-github.ts` graph and eligibility), dispatch `assertAssignee` and the Obsidian `assignment` all call `parseAssignee` in [lib/assignee.ts](../../../lib/assignee.ts); no other selector regex remains. "All four callers use one parser" holds.

The driver's friction (diagnostics name only the field) is fixed: vault, GitHub and dispatch now quote the rejected value and append `ASSIGNEE_GRAMMAR`, e.g. `invalid assignee selector "model:fixture/example:turbo"; expected agent, human, user:<name>, session:<id>, agent:<stance> or model:<provider>/<model>:<none|minimal|low|medium|high|xhigh>; only one stance and one model override combine`. Obsidian's per-issue error stays "invalid assignee".

`first-use.ts` now reads the issue back after a refused update. Re-running all five selectors: every refusal (GitHub `session:`, both malformed inputs in vault and GitHub) reads back `agent`; accepted rows and the Obsidian/dispatch columns are unchanged from the table above.

The effort enumeration is stricter than the old `[a-z]+` regexes; mlegls-pi's live issues carry no `model:` pins, so nothing stored becomes invalid there.
