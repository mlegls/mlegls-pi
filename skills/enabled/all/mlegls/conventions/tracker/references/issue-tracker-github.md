# Issue tracker: GitHub

the [vault](issue-tracker-vault.md) model over GitHub issues with `gh-axi`.

`next` is a label `next:<kind>`. `part-of` is a sub-issue (`gh-axi issue subissue add <parent> <child>`). `blocked-by` is the native dependency: `POST /repos/<o>/<r>/issues/<child>/dependencies/blocked_by` with `{"issue_id": <blocker .id>}` (the database id, not the number). where relations aren't available, `Part of #n` / `Blocked by: #n` atop the body. claim by assignee. priority is a label `p1|p2|p3` on roots.

read `gh-axi issue view <n> --comments --full`; list `gh-axi issue list --state open` with label filters; create `gh-axi issue create --title --body-file`; resolve by comment then close, and update the parent's decision line.

frontier and mine are the same filters over labels and open blockers (`issue_dependencies_summary.blocked_by`, plus body relations).

external PRs enter as issues with code attached only if the repo says so; `gh-axi pr view|diff`. issue and PR numbers share a space.
