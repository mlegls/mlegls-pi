---
stage: "done"
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

## Result

done — all eight stories held. A real BB cron tick imported the mock Beeper reply into the disposable project. Outbound Beeper and direct Gmail imports advanced the expected dates, and replay left both contact files byte-identical. No product repair was needed.

```yaml
commit: 839067de
stories:
  - {story: "Validate valid and malformed outreach records", outcome: held}
  - {story: "Read snapshot v1 from the main or linked checkout and distinguish due and replied contacts", outcome: held}
  - {story: "Preview and import Beeper replies, deduplicate replay, and change the queue hash on a new reply", outcome: held}
  - {story: "Import outbound Beeper messages and update last-contacted", outcome: held}
  - {story: "Preserve Beeper success history while offline and import Reddit notifications through Gmail", outcome: held}
  - {story: "Import direct Gmail messages for known addresses", outcome: held}
  - {story: "Use documented daily scheduling flags with the installed BB CLI", outcome: held}
  - {story: "Run an actual scheduled sync tick", outcome: held}
evidence:
  path: docs/attachments/outreach-vault-format-and-daily-sync/index.md
  visual: false
  shots: []
fixed:
  - Added a replayable Composio response fixture and an unseen outbound Beeper message to the evidence recipe.
tests: []
filed: []
caveats:
  - Message imports used synthetic sources. The BB scheduler and vault writes were real; the disposable project and automation were deleted.
  - Each sync scans matching history again. Gmail costs one CLI query per known address or Reddit handle, plus pagination; Beeper reads all chat pages and each matched chat’s message pages.
```

Evidence: [docs/attachments/outreach-vault-format-and-daily-sync/index.md](../attachments/outreach-vault-format-and-daily-sync/index.md)
