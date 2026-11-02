---
stage: "done"
assignee: "agent"
priority: 2
author: "session:thr_ae8q9yrxnv"
---
Investigated for the maintainer's "this seems like a defect of OM" (efficiency audit 2026-11-02, @thread:thr_ae8q9yrxnv). Session: @thread:thr_78sspagtst, `~/.bb/pi-bridge-sessions/thr_78sspagtst.jsonl`, 11 compactions from 10-29 to 11-02, model Opus 5.5 (1M window), OM worker `openai/gpt-6-luna`.

**What the user saw:** on 10-30 at 15:56Z, three minutes after a compaction, the user wrote "Are you aware that this was never my 'real' profile and everything we've done has been towards the launch video? That might have been lost across compactions."

**What OM actually did:** it didn't lose the statement. It recorded it, then buried it under reflections that say the opposite.

1. **Recorded correctly.** On 10-29 at 15:41Z the user answered "this profile is just for filming; you don't have to think of it like 'mine'". The observer recorded `bd68d2750d8a` (23:41 local): "User authorized the assistant to accept map proposals for the made-up launch-filming Missions, clarifying that the filming profile is just for recording and should not be treated as their personal profile." That line is in every later rendered summary.
2. **The observer made up a rule and judged the assistant against it.**
   - `f90cb80048d5` (16:42 local, before any user statement on the subject) says "The assistant told the user it had accepted the map change, even though acceptance should have been left to the user." No user message says that. The only user messages about accepting are bug reports.
   - After the authorization, `35c4483b6185` (00:10) says "despite the known requirement that only the user accepts proposals on their real profile", and `cc21ed156456` (00:19) says "contrary to the user's established acceptance constraint". Both contradict `bd68d2750d8a`, written 30 minutes earlier.
   - `b3063acc8fe5` (23:42) took the assistant's own framing ("Your Classical Chinese session is yours to approve", the question the user had just answered) and called that profile "the user's real Classical Chinese Mission".
3. **The reflector turned those judgments into rules and never removed them.**
   - By the 10-30 15:53 compaction the reflections included "A persistent Common Concept product invariant: learners must personally accept every … proposal on their real profile; the assistant must never accept on their behalf" (`4e19addf194d`). Others were `29fe56272ae9` and `8e07e5a56059`, plus "Launch-video filming must use an isolated filming profile rather than the user's personal Common Concept profile" (`29841ea1909a`).
   - The user's correction did produce `48d5d120b553` ("all Sessions there, including the Classical Chinese Mission, are filming setups"). But the contradicting rules stayed beside it, among them `88eb3c73ec16`: "The assistant has previously violated this constraint".
   - In the final compaction (11-02), 20 reflections still state some version of the acceptance rule.
4. **Nothing reconciles duplicates or contradictions under the pool limit.**
   - The final compaction carries 465 reflections (42.5k tokens) plus 90 observations (10.4k). The summary is 219k characters, up from 39k at the first compaction.
   - Near-duplicates pile up: 4 copies of the worktree authorization, 8 of "capture footage first, review afterward", 3 of the propose-tool fix.
   - The condenser (`agents/condenser`) is the only stage that merges or drops reflections, and it runs only above `reflectionsPoolMaxTokens`. On a 1M window that limit is half of one eighth of the window, about 62k tokens (`config.ts` `resolveReflectionPoolBudget`; [[projects/mlegls-pi/issues/condense-reflections-to-their-render-share]] chose "large-window pool fits without condensation"). So it never ran here.
   - The reflector only adds reflections. Its duplicate check is exact-match (`agents/reflector/agent.ts`).

**So the defect is contradiction, not loss.** The observer writes its own judgments as facts, the reflector promotes them to rules, and no stage resolves a conflict in favour of the latest user statement. A large-window session never condenses at all, so every call carries about 50k tokens of partly contradictory memory. The agent sees the user's permission once and the opposite rule twenty times.

## Ticket

decisions:
- 2026-11-02: maintainer approved this fix and asked for it to be started (@thread:thr_ae8q9yrxnv). The same day the OM worker model moved from openai/gpt-6-luna to openai/gpt-6.1-terra (system-config settings.json); run the acceptance replay on that model.

- **Observer** (`agents/observer/prompts.ts`): record what the user said, permissions and framing included, close to verbatim and attributed. Don't judge the assistant's actions against a rule unless a user statement sets that rule, and cite that statement when it does. The assistant's own framing isn't the user's.
- **Reflector** (`agents/reflector`): a new constraint, permission or role reflection supersedes earlier ones that conflict with it, and the latest user statement wins. The reflector can drop by id what it supersedes, as the condenser does, and the supersession is recorded so it stays recallable.
- **Pool limit:** cap the reflection pool's trigger at an absolute ceiling (about 20k tokens) as well as the window-derived share, so large-window sessions condense too. The condenser also merges near-duplicates whenever it runs.
- **Acceptance:** replay this session's ledger through the changed reflector and condenser (`session-ledger/replay-upstream.ts`). The 10-30 15:53 summary should then carry the filming-profile permission, with no reflection saying the assistant must never accept on the filming profile. The final pool should be under the ceiling, with one reflection per durable fact.


## Result

done — the three required stories hold on the driver's committed evidence. I found no defects and made no behavior changes. I did not re-run the 21-minute live replay, so those outcomes rest on the driver's packet.

I read the diff against the ticket and the driver's log. `bun run typecheck` passes and `bun test extensions/context/om` gives 12 pass, 0 fail. The repo has no `test:affected` task, so I ran the whole OM test directory.

On the legacy-condenser friction, `condenser-retains-unsupported-rules-when-only-legacy-reflections-are-available` stays an `idea`. The driver reproduced it, and only legacy pools recorded before the reflector change are exposed. I added the replay evidence to that issue and named the decision it waits on: migrate legacy pools or accept the limit. I left `reconciler-join-launch-can-start-from-enclosing-collector` alone: it came from another run and is unrelated to this change.

```yaml
commit: 895b7023
stories:
  - story: October 30 15:53 summary preserves filming-profile permission without a conflicting acceptance ban
    outcome: held
  - story: Latest user framing supersedes earlier conflicting profile framing
    outcome: held
  - story: Final reflection pool stays below the ceiling and consolidates durable facts
    outcome: held
evidence:
  path: docs/attachments/om-memory-promotes-observer-judgments-over-the-users-own-statements/drive-2.md
  visual: false
  shots: []
tests: []
filed: []
caveats:
  - "Not required by the acceptance and not observed by a driver: recall of superseded reflections and the changed observer's attribution. The implementer self-checked both. The driver saw `supersededBy` links in the generated ledger but did not run recall, and the replay reuses the historical observations."
  - "Legacy-pool condensation limit is tracked, with its decision named, in condenser-retains-unsupported-rules-when-only-legacy-reflections-are-available."
  - "Cost choices: the final duplicate sweep adds one condenser pass per run that reaches its target, and the reflector now reconciles and dedupes on every run. No per-run measure was recorded. The driver's whole-ledger replay took 20m47s for 223 reflector boundaries, and the direct condenser run took 2m56s."
  - "The branch also carries unrelated reconcile commits (lib/reconcile/*) from the base; I did not review them."
```

Evidence: [docs/attachments/om-memory-promotes-observer-judgments-over-the-users-own-statements/drive-2.md](../attachments/om-memory-promotes-observer-judgments-over-the-users-own-statements/drive-2.md)
