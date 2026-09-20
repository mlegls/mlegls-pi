# A GitHub PR loop

One reviewable increment per PR is a useful default for unattended repository
work. Scheduled runs wait while the previous PR needs attention; review
feedback updates that branch instead of creating another one.

The included files are starting material for a repository-specific integration:

- [example-skill.md](example-skill.md): a concrete type-narrowing task.
- [workflow-template.yml](workflow-template.yml): scheduled/manual PR creation
  and `/iterate` routing.
- [agent-iteration.ts](agent-iteration.ts): assembles iteration context and the
  PR-body routing marker.

The run assignment supplies the objective, selected work, context pointers,
write authority, validation, and delivery owner. A repo-local skill holds the
task's particular judgment (`writing-for-llms`). Its response becomes the PR
handoff: what changed, what was observed, and what remains.

Adapt the runner, permissions, branch policy, commands, and paths to the repo.
The starter uses Claude with repository variables `AGENT_MODEL` and
`AGENT_EFFORT`; configure these from the selected runner, or replace that step.
The workflow is a scaffold with placeholder sensor/controller steps, not an
installed loop. Selection consumes relevant memory before choosing work; an
agent that both selects and acts can do that in one invocation. The workflow
and agent also need one clear owner for commit/push.

The example's manual dispatch bypasses its scheduled one-open-PR check.
Decide whether the project wants that behavior. `/iterate` uses an authorized
comment plus a workflow marker to route feedback to the existing PR.

Observe a complete manual run and a reviewed PR before widening cadence or
batch size. Repository secrets and write credentials belong only in the
approved execution environment. A generic template cannot establish trust in
arbitrary PR code.
