# Issue tracker: local Markdown

This repo keeps work under `.scratch/`. [work.md](work.md) describes maps,
holes, tickets, and the frontier; [triage-labels.md](triage-labels.md) maps triage
roles.

One effort has:

- `.scratch/<effort>/map.md`, when a map is useful;
- `.scratch/<effort>/spec.md`, for settled intent;
- `.scratch/<effort>/issues/NN-<slug>.md`, one hole or ticket per file,
  numbered from `01` in the same sequence.

Each item has a title and `Status:`. Holes also have `Type:` for their fill
method. `Part of:` links a parent when ownership is narrower than the effort;
`Blocked by: NN, NN` lists prerequisites. `Claimed by:` identifies the working
session separately from triage status. Discussion appends under `## Comments`.

## Holes and frontier

Scan the scope's `issues/`, or `.scratch/*/issues/` project-wide, for open,
unclaimed items with satisfied prerequisites. Filter by `Type:` when requested.
A blocker marked `resolved` should contain the result its dependent needs.

Claim by adding `Claimed by: <session>` before changing the item. Resolve with
an `## Answer` (or implementation evidence), `Status: resolved`, removal of the
claim, and a linked gist in the map. Read current contents before editing so
concurrent sessions do not overwrite each other's work.

Publishing means writing the file; fetching means reading it. This adapter
needs no service or CLI.
