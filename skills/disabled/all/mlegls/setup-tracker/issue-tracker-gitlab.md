# Issue tracker: GitLab

This repo uses GitLab issues and `glab`. [work.md](work.md) describes maps,
holes, tickets, and the frontier; [triage-labels.md](triage-labels.md) maps roles
to local labels.

## Operations

- Read: `glab issue view <number> --comments`.
- Discover: `glab issue list -F json`, with label/scope filters and pagination
  sufficient for the scope.
- Create: `glab issue create --title "..." --description "..."`.
- Claim: `glab issue update <number> --assignee @me`.
- Parent: `Part of #<parent>` atop the child description and a link in the map.
- Answer: `glab issue note <number> --message "..."`, then
  `glab issue close <number>` and update the map's decision link. Close has no
  comment argument; the note comes first.

GitLab calls comments notes (`note --message`), including on merge requests.
Label updates use `--label` and `--unlabel`.

Native blocking links are available on Premium/Ultimate. Post the quick action
`/blocked_by #<blocker>` as a note on the child. Otherwise record
`Blocked by: #<n>, #<n>` atop its description.

## Holes and frontier

For a map, inspect its children. Project-wide, collect open `wayfinder:*` holes
and `ready-for-agent` tickets, excluding maps. Filter by requested method,
assignees, and unsatisfied blockers. Inspect native links via
`glab api projects/:id/issues/:iid/links` and fallback body relations. Read a
blocker's resolution to determine whether its result is available.

## Merge requests as a triage surface

**MRs as a request surface: no.** Set to `yes` when external MRs should enter
triage as requests with attached code.

Read them with `glab mr view <number> --comments` and `glab mr diff <number>`.
Discovery excludes project members' own in-flight work; explicitly named MRs
are in scope regardless of author. Issues and MRs have separate number spaces.
