---
name: setup-tracker
description: "Use when first configuring a repository’s issue tracker and triage labels, or switching trackers."
disable-model-invocation: true
---

Project-specific tracker mechanics live in `docs/agents/issue-tracker.md`.
The shared work model lives in `docs/agents/work.md`; label aliases live in
`docs/agents/triage-labels.md`. Other skills use these rather than assuming a
particular service.

1. Inspect remotes, existing agent instructions, tracker docs, and labels.
   Reuse the established tracker and vocabulary. Ask together about choices
   inspection cannot settle, including write authority when it is unclear.
2. Draft the local conventions. Start with the relevant adapter:
   [GitHub](issue-tracker-github.md), [GitLab](issue-tracker-gitlab.md), or
   [local Markdown](issue-tracker-local.md). Another tracker needs its own
   short account of equivalent operations, not an imitation of GitHub. Show the
   complete document drafts and proposed tracker changes for confirmation
   before writing (`grilling`).
3. After agreement, install the adapter as `docs/agents/issue-tracker.md`,
   [work.md](work.md) as `docs/agents/work.md`, and the needed role mappings
   from [triage-labels.md](triage-labels.md). Reuse existing labels. External
   PRs/MRs join triage only when the adapter's request-surface flag is enabled.
4. Link the installed docs from the repository's existing agent entry file.
   Use `AGENTS.md` for a new setup; retain `CLAUDE.md` where it already serves
   that role. Preserve unrelated instructions.

The files are ordinary editable project policy. Setup need not be rerun to
change a preference, and it does not bulk-migrate existing tracker items.
