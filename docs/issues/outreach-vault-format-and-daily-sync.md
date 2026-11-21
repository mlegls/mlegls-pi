---
stage: "ticket"
assignee: "agent:auto-routine"
author: "session:thr_2hd2kf9r28"
priority: 2
part-of: "[[projects/mlegls-pi/issues/outreach-conversations-in-the-bb-tracker]]"
---
Projects can track outreach hypotheses and contacts under `docs/outreach/` with a validated snapshot/check CLI and a daily Beeper + Gmail sync script. This is the `mlegls-pi` part of [[projects/mlegls-pi/issues/outreach-conversations-in-the-bb-tracker]], for [[projects/mlegls-pi/stories/manage-outreach-conversations]].

## shape

Implement the parent's "vault layout and CLI, in this repository" shape:

- Skill under `skills/enabled/all/mlegls/conventions/outreach/SKILL.md` documenting the `docs/outreach/` frontmatter/log conventions, when agents add candidates vs. update stages/verdicts, and how to run `outreach.ts`.
- CLI `skills/enabled/all/mlegls/conventions/outreach/scripts/outreach.ts` (Bun TypeScript, resolving `<main checkout>` via git common dir just like `issues.ts`):
  - `snapshot --json`: emits the exact `schemaVersion: 1` JSON contract in [[projects/mlegls-pi/issues/outreach-conversations-in-the-bb-tracker]], including `queueReason`, `queueHash`, and `lastSync` from `<git-common-dir>/outreach-sync.json`.
  - `check`: validates YAML frontmatter, hypothesis references, stage/verdict enums, and duplicate handles across `people/`.
  - `sync [--beeper] [--gmail] [--dry-run]`:
    - Beeper Desktop API (`BEEPER_API_URL`, `BEEPER_ACCESS_TOKEN`): matches chats by `beeper_chat_id` or `channels` handles, appends unseen inbound/outbound messages to `## Log` with source message IDs for idempotency, updates `last_reply` / `last_contacted` / `stage`, and records a non-fatal offline note if the Mac/Beeper is unreachable.
    - Gmail via Composio CLI: pulls threads matching known `channels.email` addresses and Reddit DM notification emails matching known `channels.reddit` handles, appending unseen entries idempotently.
    - Writes sync timestamps/errors to `<git-common-dir>/outreach-sync.json`.
- Guide `docs/guide/outreach.md` covering setup (Beeper Desktop Remote Access over Tailscale, dotenv token, daily `bb automation create --mode script` command).

Verify against a disposable git repository with seeded `docs/outreach/` files and a local mock Beeper HTTP server (plus offline-unreachable path and idempotent re-sync), leaving a runnable fixture and invocation in the handoff for the parent's combined first use.
