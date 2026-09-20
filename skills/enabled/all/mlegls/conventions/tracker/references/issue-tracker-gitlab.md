# Issue tracker: GitLab

the [vault](issue-tracker-vault.md) model over GitLab issues with `glab`.

`next` is a label `next:<kind>`. `part-of` is `Part of #n` atop the description and a link in the parent. `blocked-by` is `/blocked_by #n` as a note (Premium+), else `Blocked by: #n` atop the description. claim by assignee. priority is a label `p1|p2|p3` on roots.

read `glab issue view <n> --comments`; list `glab issue list -F json`; create `glab issue create`; resolve by `glab issue note --message` then `glab issue close` (close takes no message), and update the parent's decision line. comments are notes, on MRs too; labels are `--label`/`--unlabel`.

frontier and mine are the same filters over labels and open blockers (`glab api projects/:id/issues/:iid/links`, plus body relations).

external MRs enter as issues with code attached only if the repo says so; `glab mr view|diff`. issues and MRs have separate number spaces.
