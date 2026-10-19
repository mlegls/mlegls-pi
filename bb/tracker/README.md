# bb tracker

A bb plugin over the vault tracker (`docs/issues/`, the `tracker` skill): an **Issues** page listing a project's issues as a tree (by `part-of`) or as Ready (the frontier), Mine, Done and Archived. Rows show stage (own → effective), readiness, blockers, claims, sub-issue progress, assignee and priority; the detail pane renders the contract with issue wikilinks as in-page links.

It never writes issues. Its actions start agents:

- **Supervise** (frontier only, one or many trees): a new pi thread running `/skill:supervise`, or a message to an existing supervisor (threads it started, and the live thread holding `supervisor` in the main checkout's `desk/ROLES.md`).
- **Refine** (anything not on the frontier): a pi thread running `/skill:shape` on the trees, told why each isn't ready.
- **Discuss**: a new thread from bb's composer with the selected issues mentioned. `#` in any composer mentions an issue too; the agent receives its path, state, subtree and contract.

Keys on the page: j/k move, x select, Enter open, d discuss, s supervise (or refine), Escape clear.

A **Campaigns** page renders the project's `docs/departments.md`: the maintainer's departments (perspectives such as launch, pedagogy or ops), each ranking its campaigns. A campaign is a top-down progress view, not a branch of the issue tree: an outcome, good-enough bars (`- [ ]`, ticked when met) and a `Tracks:` line of issue links and backticked slug patterns whose subtrees it counts; several campaigns may track the same issue. Each card shows bars met, done / settled (goal, spec, ticket) / idea counts, issues landed on main per week for twelve weeks (first-parent history, so a merge lands its branch's work on its own date), when it last moved, and the reconciler chains working on it, linked to their threads. A department may list promises (`- text check: name` or `confirmed: YYYY-MM-DD`); frontmatter `facts: <command>` names a command run in the project root (cached ten minutes, Refresh reruns it) that prints `{ checks: { name: { level: ok|risk|broken|unknown, note } }, notes: { department: [line] } }`. Open issues no campaign tracks are listed last.

The page never writes. Discuss on a department, campaign or promise opens a thread with it mentioned (`!` in any composer mentions one too): the agent receives what the page shows and where it comes from, and records decisions in `docs/departments.md`. Triage opens a thread that places the untracked issues.

Reads go through `issues.ts snapshot --json` from a copy pinned at the tracker checkout's HEAD (`~/.local/state/mlegls-pi/tracker-pin/`, shared with the reconciler), refreshed when files under `docs/issues/` change. Settings: `trackerScript` (default `~/.pi/agent/skills/tracker/scripts/issues.ts`) and `bun` (default: found through the login shell).

```sh
bb plugin install .      # once, from this directory
bb plugin dev            # rebuild and reload on save
npx tsc --noEmit -p .
```
