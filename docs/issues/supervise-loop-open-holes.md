---
stage: idea
assignee: agent
priority: 4
author: session:01a0f065-abaf-776c-bc8b-419cb9b312e4
---

2026-10-01: `ab supervise` was deleted; [[projects/mlegls-pi/issues/reconcile-the-execution-tree-with-lazy-exception-handlers]] is level-triggered, so the first three holes (lost events, crossing stories left to the owner, cached job modules) are moot. The rest still apply to it.

Open holes carried over from [[projects/mlegls-pi/issues/archive/scripted-supervision-loop]] when it closed on 2026-09-30, verbatim. Each needs evidence or a decision before becoming work. Split one out as its own issue when it bites.

- the loop saves a child's turn-end cursor before handling it; a handling error now wakes the owner, but a daemon killed mid-handling loses that event (resume <child> verify|integrate recovers).
- crossing-story verification at subtree end is left to the owner; no Jev check yet.
- the daemon caches job modules: `ab daemon shutdown` after changing lib/jobs code (jobs resume on next start).
- the strict caveat rule wakes on boilerplate like "no test suite configured"; relax with data.
- 25 of 112 turn ends in the 2026-09-23 campaign had no sentinel under the old prompts; watch the rate under the new ones.
- Jev preflight lint on assignment prompts in `dispatch` (checklist-commissioned tests, wrong stance, audit inside hacking). Wanted by the loop's templated assignments too.
- pinning the roster per campaign, or linting that "start with `X`" names an existing skill: the stance files changed mid-campaign.
- verifier environments are the main block (ports, deployments, sign-in); project-side, e.g. a concept `verify:env` task with isolated ports and a signed-in `storageState`.
