---
name: outreach
description: Use when tracking outreach hypotheses, candidates, and conversations in a project's outreach vault.
---

Work in the main checkout's `docs/outreach/`, beside `docs/issues/`. Use one Markdown file per slug:

- `hypotheses/<slug>.md`: `status: active | confirmed | killed | paused`, optional `started` (`YYYY-MM-DD`) and `bar` (one line). Body: verbatim hypothesis, confirming behavior, kill criteria, search specs.
- `people/<slug>.md`: `name`, `stage: candidate | messaged | replied | active | dropped`, `channels` (mapping of `x`, `reddit`, `linkedin`, `substack`, `email`, `beeper_chat_id`, etc. to quoted handles/addresses). Optional `hypothesis` (slug or list of slugs), `verdict: open | confirm | kill` (defaults to `open`), `priority` (1–4), `last_contacted`, `last_reply`, `next_followup` (dates). Body: `## Evidence` with a discovery quote and source link; `## Log` with messages.

When researching, add sourced candidates or attach the hypothesis to their existing records. Change stage for observed contact or conversation state; set a verdict from evidence against the hypothesis's bar. Record outbound contact and follow-up dates. To clear a Queue item without changing the record, use Mark handled in BB.

Append log messages under `### YYYY-MM-DD HH:MM · <channel> · inbound|outbound` (UTC), with `id: <source-msg-id>` on the next line when available. Quote the message below. Preserve existing entries.

From the project, run `bun <skill-dir>/scripts/outreach.ts check` after edits; `snapshot --json` shows what BB reads. `sync --dry-run` previews imports; `sync` reads Beeper and Gmail, or select `--beeper` / `--gmail`. Sync writes the Markdown in the main checkout even when invoked from a linked worktree. See [setup](../../../../../../docs/guide/outreach.md).
