# Issue tracker: GitHub

This repo uses GitHub issues and `gh-axi`. [work.md](work.md) describes maps,
holes, tickets, and the frontier; [triage-labels.md](triage-labels.md) maps roles
to local labels.

## Operations

- Read: `gh-axi issue view <number> --comments --full`.
- Discover: `gh-axi issue list --state open`, with label/scope filters and a
  limit sufficient for the scope. API pagination is available for full scans.
- Create: `gh-axi issue create --title "..." --body-file <path>`.
- Claim: `gh-axi issue edit <number> --add-assignee @me`.
- Parent: `gh-axi issue subissue add <parent> <child>`.
- Answer: `gh-axi issue comment <number> --body-file <path>`, then close with
  the appropriate reason and update the map's decision link.

Native issue dependencies represent blockers. The endpoint is
`POST /repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by` with JSON
`{"issue_id": <blocker database id>}`. The database ID is `.id` from the issue
API, not its issue number or GraphQL node ID. `gh-axi api` supports these calls.

Where native relations are unavailable, use a task-list link in the parent,
`Part of #<parent>` on the child, and `Blocked by: #<n>, #<n>` on dependents.

## Holes and frontier

For a map, inspect its children. Project-wide, collect open `wayfinder:*` holes
and `ready-for-agent` tickets, excluding maps. Filter by requested method,
assignees, and unsatisfied blockers. The API's
`issue_dependencies_summary.blocked_by` counts open blockers; check fallback
body relations too. Read a blocker's resolution when determining whether its
answer or implementation is actually available.

## Pull requests as a triage surface

**PRs as a request surface: no.** Set to `yes` when external PRs should enter
triage as requests with attached code.

Read them with `gh-axi pr view <number>` and `gh-axi pr diff <number>`. Discovery
includes contributor PRs rather than the maintainer's own in-flight work;
an explicitly named PR is in scope regardless of author. GitHub shares issue
and PR numbers, so resolve which surface a bare number names.
