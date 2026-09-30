# Exception-only supervisor

Tested revision: `dab61aa` (2026-09-30). This packet records the instruction rewrite and campaign preparation, not a completed GLM campaign.

The skill, `agents/supervise.md`, pipeline role and CLI help now agree: the script owns drive/review, joins and integration; the owner handles exceptions. Solved exceptions go only to the waiting child. Waiting turns explicitly override the common worker sentinel rule. The interactive root keeps open human questions in `holes` and generates status from the loop only when asked. The supervisor model defaults are unchanged pending the follow-up GLM trial.

## Prepared surface

- Delivery environment: local instruction loading and composed worker prompts, with existing loop/report regressions. The real GLM campaign is a follow-up owned by the parent supervisor at join, not this delivery's acceptance gate.
- Prepared target: this ticket's local worktree/branch `supervise-as-exception-handler`; no deployment, browser, seed or child workers started.
- Persona/auth: local instruction reader; `pi auth check --provider zai --json` reported `ready`, API-key auth. A GLM root uses existing Pi authentication (`ZAI_API_KEY` when supplied through the environment); no credential belongs in this packet.
- Opened entry point: `ab skill ./skills/enabled/all/mlegls/orchestrations/supervise/SKILL.md` from this checkout. It loaded the rewritten skill with this checkout's skill/workspace paths.
- Also opened `bun ab/main.ts supervise --help` and assembled the full worker prompt through `lib/wm.ts` with `PI_AGENTS_DIR="$PWD/agents"`. The composed role and stance explicitly override the inherited common sentinel rule for waiting turns.
- Global skill/agent symlinks still point at the canonical checkout. A campaign after parent integration will use those merged instructions. A bare global `ab` or worker launched before integration is not proof of this revision; existing owner: [[projects/mlegls-pi/issues/drive-pi-extensions-from-reviewed-worktree]].

## Observed checks

`ab check -- bun test lib/jobs/supervise.test.ts lib/jobs/supervise-outage.test.ts lib/report.test.ts`: **18 passed, 0 failed**, 61 assertions. These are existing loop/report regressions, not a live-model encounter or new acceptance tests. `git diff --check` passed.

Tracker semantic lint was refreshed before the parent ruling. At that point its suspected completion was not justified because the required real-campaign measurement remained open. The parent then explicitly separated that comparison from this delivery. The quoted status-free supervisor behavior was recorded as fixed, not an unowned defect.

Repository-wide tracker `check` exited 1: an inline-code `[[parent]]` example was treated as a live link, and three archive-link repairs were offered. The inline-code defect is owned by [[projects/mlegls-pi/issues/tracker-check-flags-inline-fixture-wikilinks]] in the active `small-ab-cli-fixes` campaign; safe/scoped repair belongs to its prerequisite [[projects/mlegls-pi/issues/tracker-check-fix-rewrites-other-sessions-dirty-files]]. No blanket `check --fix` was run over peers' files. This check is not reported as passed.

## Campaign comparison deferred by the parent

`issues.ts frontier --json` returned no issues. [Campaign availability](campaign-availability.json) records the candidate snapshot: agent-ready roots have in-flight children, remaining leaves are already owned or dependency-blocked, and `loop-vs-supervision-tree` requires human ownership. No existing campaign was taken over or dispatched again.

The parent supervisor ruled on 2026-09-30: the rewrite and its regressions are the delivery; the parent will file a separate comparison ticket at join, using the next newly shaped campaign. No campaign has been started; wakes, coordination cost and human-facing message counts are **unmeasured**, not zero. This is an accepted evidence limit for this ticket, not a claim that the comparison happened.

## Comparison to record on that run

Use a fresh root on `zai/glm-5.3-flash:high`, with the merged skill and confirmed campaign ownership. Record its selected scope, base/head, root/session identities and final loop state. Keep child code out of the root's context. Preserve root and nested-loop `metrics.wakes`/`ownerBytes`, separate completion notifications from exception wakes, and count actual owner turns and human-facing questions/status/completion versus unsolicited progress messages from the root transcript. Routine script transitions aren't owner wakes.

Compare with [[projects/mlegls-pi/research/orchestration-audit-2026-09-23]]: root 420 inbound messages and 317 narrations; root cost $23.5, six sub-supervisors $100.8; coordination about 49% of $252. Those counts describe a larger 101-session campaign, so report completed work and wall time alongside totals rather than claim equivalence from a smaller sample. For coordination cost include root, nested supervisors and oracle consultations; preserve provider/token/cache breakdown. GLM subscription consumption is not zero-dollar API spending: retain quota-window observations where available and separate them from list-price estimates. Record the final open-human-question ledger and any exceptions that needed an oracle or human.
