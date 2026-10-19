# Independent first-use drive

Tested revision: 9851169e46e95a8d4e2d82a798e3e148a7b6d1b7. Nonvisual library/CLI journey; no screenshots. No implementation, tests or fixture code inspected.

## Predictions recorded before use

1. The committed isolated fixture with 64k context will compact memory larger than its 8k summary allowance into at most 8k estimated tokens, append an omission notice, and leave omitted records recallable. **Met.**
2. --budget 4000 will override the window-derived budget; --window 0 will fall back to 8000. **Met.** Newest observations should receive at least half the available allocation. **Unobservable:** the entry prints counts, not record identities or per-section token allocation.
3. Read-only continuation replay with --window 1000000 should retain the supervisor role reflection. **Met for replay only.** A live reload and next actual compaction remain **unobservable** in this owned fixture.
4. No auth, server or external writes expected. **Met as exposed by the documented isolated entry**, which completed without credentials or services. Temporary-store cleanup is documented, not independently inspected.

## Setup and encounter

Checkout-owned isolated local fixture, no auth/persona, temporary seeded state; readiness established by successful entry completion. No inherited deployment selector was reused. All commands below exited 0 on 2026-10-19. No servers or external resources started.

Entry: `bun docs/attachments/om-reflections-grow-without-a-budget/first-use.ts`.

| Action | Budget | Estimated summary tokens | Rendered reflections / observations | Omitted / recalled |
| --- | ---: | ---: | ---: | ---: |
| Default entry | 8000 | 7914 | 23 / 34 | 483 / 483 |
| Entry plus --budget 4000 | 4000 | 3897 | 11 / 16 | 513 / 513 |
| Entry plus --window 0 | 8000 | 7914 | 23 / 34 | 483 / 483 |

All three reported 300 stored/projected reflections and 240 stored/projected observations. All reported storage safety defaults 60000 / 40000. Default and fallback omission notice:

> (277 older reflections and 206 older observations omitted to fit the summary budget; they remain in the session memory ledger, see /om:view full.)

The 4k notice named 289 older reflections and 224 older observations. Counts reconcile with records retained, and every omission was reported recalled.

Continuation action: entry plus `--session "$HOME/.bb/pi-bridge-sessions/thr_vetzcc74ex.jsonl" --window 1000000`, using the documented read-only snapshot path, not a deployment of this branch to the live thread. Reported mode explicitly says `session snapshot (not a live reload)`. Session 01a14e7f-a8d1-74b9-a802-0b9ba1d30c3f, cut a6a970e8; budget 125000; summary 22398 tokens; 131 reflections and 125 observations rendered; role d096ed8a3b51 rendered true. No omissions. This supports continuation replay, not the required next live compaction.

## Replayable checks and frictions

- Repeat the three isolated commands above. Accept summaryTokens <= budget, omissionLine naming both omitted counts, and omitted == recalledOmissions; require unchanged stored/projected counts across budget variants.
- Repeat the documented continuation command. Accept roleRendered true with the supplied 1M window. Do not interpret this as a live reload check.
- Allocation/order check remains unavailable at this entry: it exposes only record counts and aggregate tokens, not selected identities or section tokens. Reviewer should verify newest-first and observation reservation through its public surface.
- Live acceptance remains owned by the existing execution ticket: after landing and reload, inspect the supervisor's next real compaction for the role reflection. This driver has neither landed the branch nor reloaded the shared supervisor. No substitute evidence waives that requirement.
- Unit tests and type checking were not run: they are not this user's surface. Implementer evidence remains in index.md.

No product failure observed. Friction: the provided entry reaches a simulated compaction and read-only replay, not the required live post-reload event. This is an acceptance/setup limit already explicitly owned by om-reflections-grow-without-a-budget, not a new tooling defect.
