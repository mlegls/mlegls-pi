# First-user drive: exception-only supervisor

## Before opening the product

Revision: `2d4bd2526f4c4358bef03afac9402eded87bb819`.
Owned target: local `supervise-as-exception-handler-drive` worktree. Deployment kind: instruction-loading/CLI documentation, not a running campaign. Persona: supervisor learning the workflow from its ticket and user-facing instructions; local loading needs no credentials. Seed/state: no services or campaigns started. Entry: `ab skill ./skills/enabled/all/mlegls/orchestrations/supervise/SKILL.md`.

The committed ticket records an explicit parent decision: the live GLM campaign comparison belongs to a follow-up at join, not this rewrite's gate. I will not take over an active campaign or treat documentation as live-model behavioral evidence.

Predictions, recorded before loading the skill:

1. Exception owner: I expect an executable loop-start command, then a clear wake-handling ladder: simple steering, recorded decisions, one-shot astra/fable low with question and evidence, and escalation with a recommendation. Solved exceptions should be sent only to the waiting child.
2. Boundaries: I expect the owner not to read children's code, review their work, or narrate progress. I expect an explicit way to wait without falsely declaring completion.
3. Interactive root: I expect a durable open-human-question ledger and a way to answer a status request by reading current loop state rather than replaying events.
4. Instruction consistency: I expect the skill entry, supervisor stance and CLI help to describe the same owner responsibility without making me reconstruct it from implementation.
5. Follow-up: I expect the required GLM first use to remain explicitly unmeasured here; no performance or wake-count claim can be established from loading instructions.

## Session log

- Confirmed branch and revision; working tree was clean. Read the committed ticket and its setup packet. Board messages agree that the parent separated the real campaign trial and forbids taking an already-owned campaign.
- Loaded the provided skill entry successfully. Its expanded `PI_SKILL_DIR` and `PI_WORKSPACE` are this worktree, not the implementer's worktree. Read the supervisor stance and pipeline role as user-facing instructions; did not read implementation, diffs, tests or fixtures.
- Ran the checkout CLI's `bun ab/main.ts supervise --help`. It gives start/status/resume/adopt/stop commands, assigns drive/review and consolidation to the script, forbids owner code-reading/reviews/narration, and permits `done` only after subtree completion and residual disposal.
- Ran `bun ab/main.ts supervise status supervise-as-exception-handler`: observed `no supervision jobs here`. This establishes an unstarted local target, not the state of the parent's campaign. No campaign, child, server or browser was launched.
- Followed the skill's entry instruction with `bun ~/.pi/agent/skills/tracker/scripts/issues.ts lint supervise-as-exception-handler`. It returned bounded/incomplete triage suggestions (completed, superseded, parent, unowned), all quoting the recorded parent decision. Reconciliation: rewrite verification remains open in this drive; the real campaign measurement is explicitly parent-owned and not this gate; no scope or stage was changed. These suggestions are not a failed check or a live behavioral observation.
- Confirmed the inherited launcher/authorship selectors without opening their implementation: `command -v ab` returned `/Users/mlegls/dev/mlegls-pi/bin/ab`; `ls -l ~/.pi/agent/skills/supervise ~/.pi/agent/agents` showed both global links target the canonical checkout. This is the already-filed [checkout-identity friction](../../../issues/drive-pi-extensions-from-reviewed-worktree.md), not evidence of the branch's runtime behavior. Workaround here: explicit worktree skill path, stance paths, and `bun ab/main.ts` for CLI commands. No Pi worker was started, so global prompt composition was not exercised.

## Story outcomes

| Story | Outcome | Observable evidence |
| --- | --- | --- |
| Rewrite the owner as a loop starter and exception handler | held | The loaded skill provides `ab supervise start <slug>` and the steer → recorded-answer → one-shot oracle → recommended escalation ladder. It specifies fresh `pi --print --no-tools --no-extensions --no-skills --no-context-files` consultation, astra/fable at low effort, a self-contained question/evidence, and no consultation chain. |
| Solved exceptions go only to the child; no code-reading, review or progress messages | held | Skill explicitly gives `ab mail <address-from-wake> '<answer>'`, prohibits acknowledgements/broadcasts, code-reading, added reviews and narration. Stance, role and checkout help agree. Waiting ends are explicitly sentinel-free rather than premature `done`. |
| Interactive root has an open-question ledger and on-demand status | held | Skill names root issue `holes` with question/recommendation/blocked scope/already-asked flag; answers go under `decisions` and resolved holes are removed. It says ask once and use `ab supervise status <slug>` only when asked. The status command was reachable and honestly reported no local jobs. |
| Real GLM campaign comparison | unobservable | Explicitly removed from this ticket's gate by the recorded parent decision. No campaign, wakes, human messages, cost or live-model compliance measured. |

These are **instruction-surface outcomes**, not evidence that a running model follows the instructions. The ticket's agreed rewrite was reachable from its setup entry. No child implementation, tests, fixtures or diffs were opened.

## Expectations

- E1, met: starting and wake-handling instructions were concrete; each rung and its authority boundary was explicit.
- E2, met: waiting turns have an explicit exception to the sentinel rule, and child-only solved replies do not produce an upward acknowledgement.
- E3, met: root questions have a durable ledger lifecycle, and status has a public command.
- E4, met for the explicitly opened checkout surfaces: skill, stance, role and CLI help agree on exception-only ownership. Global worker composition remains unobserved.
- E5, met: the live GLM measurement remains explicitly unmeasured and parent-owned.
- E6, formed while using the product, met: querying status on this unstarted checkout should say there are no local jobs, not imply the parent's campaign is absent. Observed `no supervision jobs here`.
- E7, formed while using the product, not met: a bare globally installed launcher/skill selector is not pinned to this checkout. The executable and agent/skill links point at the canonical checkout; used explicit local paths instead. Existing owner is linked below.

## Frictions

- Global checkout identity is easy to mistake for branch identity. The exact skill entry worked, but the skill's subsequent bare commands/global worker discovery cannot establish this revision's runtime without further pinning. Existing owner: [[projects/mlegls-pi/issues/drive-pi-extensions-from-reviewed-worktree]]. Its documented extension-pinning workaround is relevant to the follow-up live campaign; this drive avoided launching workers.
- Entry lint produced four advisory prompts quoting the same accepted scope decision. I had to reconcile them against that decision before proceeding; no unavailable-evidence error occurred, and the bounded-context label correctly avoided claiming certainty.

## Replayable checks for the reviewer

1. From revision `2d4bd25` or its descendant in an isolated checkout, load the provided skill path. Accept only if its expanded workspace/skill paths resolve to that checkout and the printed instructions contain the four-rung exception ladder, fresh astra/fable low consultation with question/evidence, child-only replies and the no-code/no-review/no-progress boundaries.
2. Open the checkout's `agents/supervise.md` and `agents/roles/supervise.md`, then run `bun ab/main.ts supervise --help`. Accept if all assign drive/review/integration to the script and exception handling to the owner, explicitly require sentinel-free waiting turns, and reserve `done` for subtree completion with residuals resolved.
3. Read the interactive-root paragraph from the loaded skill. Accept if `holes` records question, recommendation, blocked scope and already-asked state; resolved answers move to `decisions`; questions are asked once; status is generated with `ab supervise status <slug>` only on request.
4. In a checkout with no started supervision jobs, run `bun ab/main.ts supervise status supervise-as-exception-handler`. Accept an explicit empty local-state result (`no supervision jobs here`), without starting or taking over another checkout's campaign.
5. Before the follow-up live drive, resolve `command -v ab` and the global agent/skill symlinks. Accept either selectors pinned to the tested checkout or an explicit owned-launch setup that pins all relevant instructions/extensions. A responding process or canonical global selector alone does not identify the tested revision.

## Cleanup and limits

No services, campaigns, workers, deployments, browser pages or native windows were started. No cleanup handle exists. The entry lint refreshed the ordinary tracker cache; no tracker-wide fix, stage change or product repair was performed. Visual evidence: false; screenshots: none.
