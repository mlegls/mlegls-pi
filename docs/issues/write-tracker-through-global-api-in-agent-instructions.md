---
stage: ticket
assignee: agent:fill
author: session:01a12f5a-57a3-74f5-be56-010e18f3b368
part-of: "[[projects/mlegls-pi/issues/reconcile-against-a-global-tracker]]"
blocked-by: ["[[projects/mlegls-pi/issues/global-vault-tracker-backend]]"]
priority: 2
drive: none
---

Make tracker and role instructions describe the parent's global tracker protocol: code/evidence commits stay on worker branches, issue writes go through the tracker immediately, and done waits for the owner's target landing.

## Context and ownership

Read the parent's dated decisions, exact CLI verbs and claim-token seam, plus `lib/tracker.ts`. Child 1 implements them; child 2 consumes them and supplies `reconcile:<root>/<refine-handle>` in refine prompts. Work in the repository's skill sources, not installed `~/.pi/agent/skills` symlinks.

Own:
- `skills/enabled/all/mlegls/conventions/tracker/SKILL.md`, `references/issue-tracker-vault.md`, `references/lifecycle.md`, and the common read/write procedure in GitHub/GitLab references where applicable.
- `agents/roles/*.md`, `agents/reviewer.md`, `agents/tidy.md`, and contradictory tracker-branch sentences in `agents/_common.md` / `agents/compile.md`.
- The directly conflicting lifecycle/orchestration skill sentences in `skills/enabled/all/mlegls/lifecycle/{advance,orient,implement}/SKILL.md` and `orchestrations/supervise/SKILL.md`.

No runtime/CLI/source tests, GitHub backend or label model, role routing/model lists, or unrelated prompt gardening. `routing.md` and `writing-skills` give the existing style and stance precedent; keep the patch subtractive.

## Literal edit contract

1. Tracker entrypoint distinguishes backend storage from global operations. A vault lives only in `docs/issues/` of the git common dir's main worktree; CLI from a linked/sparse worker resolves there. Remove the current nearest-checkout preference and procedure that says completion/archival rides the implementation branch. Retain non-git vault discovery, issue paths, lifecycle/frontmatter/link formats and archive procedure; this change adds no archive verb.
2. Document the parent's exact `text`, `fields`, `create`, `update --fields/--body-file`, `close`, `remove` commands with one copyable create/update example. Fields are normalized slugs/guards, null removes a key, body input excludes YAML and replaces the whole body when supplied; body-only update is allowed. Writes validate globally and commit only touched canonical issue paths for persistence. Issue reads/edits go through the backend, not a worker's filesystem or `git show`.
3. Claims, parent/blocked-by edits, decisions, contract sharpening and new friction are immediate tracker writes. Friction is filed outside the active execution subtree and linked from the report; delete the `_common` branch-carried-new-idea wording. Code, shared interface stubs, tests already authorized by the ticket, and `docs/attachments/` evidence still commit on the worker branch; workers still do not integrate or push the canonical checkout. The backend's canonical persistence is not permission for a worker to commit unrelated canonical files.
4. Refine promotes or writes its child contracts through the tracker, committing only shared stubs on its branch. New children carry the exact supplied provisional `claimed-by` token atomically on create. Report their slugs. A continuation that adopts an earlier attempt's children says which ones and updates their claim to the supplied successor token; the reconciler removes unadopted provisional children and changes accepted-child claims to `reconcile:<root>`, keeping them reserved until target close or move-out. Refiners do not remove pre-existing children. Reflect this in `agents/roles/refine.md` and `agents/compile.md`, replacing branch-commit orders rather than appending contradictory caveats.
5. Handlers write body rulings and move-outs through the tracker immediately; remove `on your branch` and `tracker files only; the reconciler lands them`. Keep authority boundaries, honest stages, parent blockers and the existing resolution handoff. Global ruling visibility does not imply code is integrated.
6. Implement/drive/review/tidy do not close their execution ticket on a report or a collector landing. They supply the existing setup/stories/evidence handoffs; the reconciler closes with the result only after code reaches its owner's target. Standalone non-reconciler resolution still closes after the recorded acceptance and actual target landing. Explain collector-landed as pending/derived inflight, not globally done; lifecycle's branch-local done scan is replaced by the landing ledger.
7. Reviewer triage observes newly filed *tracker* friction, not only `stage: idea` files in the code diff. Keep its existing triage dispositions. `remove` is reserved for provisional children; settle already-fixed/caller-error/accepted-limitation captures with a closed disposition/result, or transfer evidence to the existing owning issue, rather than teaching deletion of arbitrary tracker issues. Preserve two-minute fixes and no-unowned-friction rules.
8. Update orient/advance's contradictory `closed on branch` and in-flight-issue branch-view wording to global contract + ledger + code/evidence branch distinctions. Keep their read-only/owner boundaries. The supervisor reconciles the global result after code lands; no branch issue commit is a completion signal.
9. Backend-agnostic roles say `through the tracker` and defer command/backend details to the tracker skill. Do not claim GitHub supports these newly documented verbs yet: its backend is a later blocked sibling. Preserve the GitHub/GitLab model conventions and their own publishing commands.

## First use and acceptance

This is `drive: none`: the post-landing gate is owned by the parent join, which reads the deployed instructions beside child 2's scratch rehearsal and runs the global CLI/collector story. Document changes cannot be observed in agents launched from this branch merely by assuming installed role/skill symlinks switched. Hand off the source paths and the supervisor's restart/reload step; no live prompt deployment from this worker.

- A refiner following the instructions can create claimed children from a sparse worktree and replace a parent contract through the tracker without editing/committing `docs/issues/` on its branch.
- A handler can record a ruling/move-out globally; a worker files friction globally while still committing code/evidence locally.
- Nobody following the changed prompts marks a reconciled node globally done merely because it reported done or landed in a collector.

Review the listed source instructions as one protocol and compare all example commands/types with the committed parent contract and child 1's actual CLI help. Search the scoped files for surviving `implementation branch`, `tracker files only`, `commit children`, `on their branch`, and branch-local issue reads, examining hits rather than blanket-replacing generic code instructions. No new tests, no new process or model run required. Provide nonvisual review evidence under `docs/attachments/write-tracker-through-global-api-in-agent-instructions/`; the parent scratch encounter is the post-landing acceptance, not a prose search claiming product success.
