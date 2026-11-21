---
stage: "done"
assignee: "agent:auto-routine"
author: "session:thr_2hd2kf9r28"
priority: 2
---
The maintainer manages outreach and GTM conversations per project in a fourth page of the [tracker plugin](../../../bb-plugins/tracker/README.md), backed by `docs/outreach/` alongside `docs/issues/`, with a daily bb automation syncing replies from Beeper Desktop (on the Mac) and Gmail. For [[projects/mlegls-pi/stories/manage-outreach-conversations]] (@thread:thr_2hd2kf9r28).

A panel in tracker rather than its own plugin or Obsidian, following [[projects/mlegls-pi/issues/attention-inbox-in-the-bb-tracker]]: tracker already resolves each project's main checkout, watches `docs/`, publishes realtime updates, supports composer mentions (`#`, `!`), and opens Discuss threads. Agents write the files; the panel stays read-only except for ephemeral inbox "handled" state in plugin storage.

## shape

### vault layout and CLI, in this repository

Storage lives in `<main checkout>/docs/outreach/` (git-tracked, browsed in Obsidian beside `docs/issues/`):

- `docs/outreach/hypotheses/<slug>.md` — strict YAML frontmatter:
  - `status: active | confirmed | killed | paused`
  - `started: YYYY-MM-DD` (optional)
  - `bar: string` (optional one-line kill/confirm bar shown on cards)
  - Body: verbatim hypothesis, confirming behavior, kill criteria, search specs.
- `docs/outreach/people/<slug>.md` — strict YAML frontmatter:
  - `name: string` (display label, e.g. `@ConvictionStack` or `prepend`)
  - `hypothesis: string | string[]` (slugs under `hypotheses/`, optional)
  - `stage: candidate | messaged | replied | active | dropped`
  - `verdict: open | confirm | kill` (default `open`)
  - `priority: 1 | 2 | 3 | 4` (optional, for shortlist ordering in Candidates)
  - `channels`: mapping of known handles/addresses (`x`, `reddit`, `linkedin`, `substack`, `email`, `beeper_chat_id`, etc.)
  - `last_contacted: YYYY-MM-DD` (optional)
  - `last_reply: YYYY-MM-DD` (optional)
  - `next_followup: YYYY-MM-DD` (optional)
  - Body: `## Evidence` (discovery quote + source link) and `## Log` (append-only dated entries `### YYYY-MM-DD HH:MM · <channel> · inbound|outbound` with optional `id: <source-msg-id>` for idempotent sync deduplication).

Skill and CLI under `skills/enabled/all/mlegls/conventions/outreach/` (`SKILL.md` + `scripts/outreach.ts`):

- `outreach.ts snapshot --json` (read-only, resolved against the git common dir's main worktree) prints:
  ```json
  {
    "schemaVersion": 1,
    "root": "/abs/main/checkout",
    "repo": "concept",
    "at": 1700000000000,
    "lastSync": { "beeper": "ISO|null", "gmail": "ISO|null", "errors": [] },
    "hypotheses": [
      { "slug": "...", "path": "docs/outreach/hypotheses/....md", "status": "active", "bar": "...", "summary": "..." }
    ],
    "people": [
      {
        "slug": "...", "path": "docs/outreach/people/....md", "name": "...",
        "hypotheses": ["..."], "stage": "replied", "verdict": "open", "priority": 1,
        "channels": { "x": "@..." },
        "lastContacted": "YYYY-MM-DD|null", "lastReply": "YYYY-MM-DD|null", "nextFollowup": "YYYY-MM-DD|null",
        "queueReason": "replied|due|null", "queueHash": "sha256-of-queue-state"
      }
    ]
  }
  ```
  `queueReason` is `"replied"` when `stage === "replied"` (or latest `## Log` entry is `inbound` after `lastContacted`), `"due"` when `stage !== "candidate" && stage !== "dropped"` and `nextFollowup <= today`, else `null`. `queueHash` hashes `(stage, lastReply, nextFollowup, logEntryCount, lastLogEntryId)` so new replies or future due dates invalidate a "handled" mark.
- `outreach.ts check` validates YAML frontmatter, hypothesis references, and duplicate channel handles across `docs/outreach/people/`.
- `outreach.ts sync [--beeper] [--gmail] [--dry-run]`:
  - **Beeper Desktop API** (`BEEPER_API_URL`, e.g. `http://<mac-tailscale-host>:23373`, + `BEEPER_ACCESS_TOKEN` from dotenv/env): queries chats matching known `beeper_chat_id` or `channels` handles (X, LinkedIn, etc.), appends unseen messages to `## Log` (deduped by message ID), records `beeper_chat_id` once matched, updates `last_reply` / `last_contacted` and advances `stage` (`candidate|messaged → replied` on inbound). If the Mac/Beeper is unreachable, records a non-fatal status note in `lastSync` without failing Gmail sync.
  - **Gmail via Composio CLI** (`composio execute` on the linked Gmail account): pulls messages matching known `channels.email` addresses plus Reddit DM notification emails matching known `channels.reddit` usernames (`u/...`), appending unseen entries to `## Log` and updating `last_reply` / `stage`.
  - Records sync metadata in `<git-common-dir>/outreach-sync.json` (untracked) so `snapshot --json` exposes `lastSync` without dirtying the repo when nothing changed.
- Guide `docs/guide/outreach.md` documenting `docs/outreach/` conventions, Beeper Desktop Remote Access over Tailscale + dotenv token setup, and the daily `bb automation` command (`bb automation create --project ... --mode script`).

### the panel, in `~/dev/bb-plugins/tracker`

- [server.ts](../../../bb-plugins/tracker/server.ts): `outreach` RPC reads `outreach.ts snapshot --json` for a project that has `docs/outreach/` (watching `docs/outreach/` recursively with `fs.watch`, publishing `OUTREACH_CHANGED`), plus `outreachPerson` (raw frontmatter + markdown body) and `outreachHandled` (`mark` / `unmark`, persisted in plugin storage keyed by `(projectId, slug, queueHash)` just like [attention-service.ts](../../../bb-plugins/tracker/attention-service.ts) stores answered records). Entries whose `queueHash` no longer matches or whose person left `Queue` are pruned on read.
- Composer mention provider (`~` trigger, distinct from `#` issues and `!` campaigns) resolving `docs/outreach/people/` and `docs/outreach/hypotheses/` so any thread receives the person's record, log and linked hypothesis.
- [app.tsx](../../../bb-plugins/tracker/app.tsx): `navPanel` "Outreach" with `experimental_useBadge` counting unhandled `Queue` items across projects with `docs/outreach/`.
  - Views: **Queue** (unhandled replies + due follow-ups, with a toggle to show handled items and undo), **Candidates** (uncontacted leads with `stage: candidate`, grouped/filterable by hypothesis, ordered by `priority`), **Hypotheses** (rollup cards with confirm/kill progress bar, reply counts and linked threads), **All**, **Dropped**.
  - Single **Discuss** action (works on 1 or multi-selected people/candidates, or a hypothesis card) opening a BB thread with them mentioned — covers drafting openers/follow-ups, critiquing replies, and updating stage/verdict without separate button templates.
  - **Mark handled** button (`h` shortcut) in Queue clears the item immediately via `outreachHandled` without editing markdown or waiting for sync; a new synced reply or later due date changes `queueHash` and resurfaces it.
  - Keyboard nav (`j/k` move, `x` select, `h` mark handled in Queue, `d` discuss, `Escape` clear) and `lastSync` footer showing Beeper/Gmail timestamps or offline status.

Out: inline editing of markdown files from the UI; sending DMs/emails directly from the panel; Reddit browser scraping; automatic product-database joins (future follow-up).

First use: in a disposable project with `docs/outreach/`, seed one hypothesis, two uncontacted candidates, and one messaged contact; run `outreach.ts sync` against a local mock Beeper HTTP server that returns an inbound reply; verify the reply lands in `## Log` and the contact moves into Outreach Queue with badge count 1; mark it handled (badge drops to 0), then inject a second inbound reply and re-sync so it resurfaces; select a candidate in Candidates and open Discuss to verify the thread receives the person + hypothesis context.

decisions:
- 2026-11-21: lives in the tracker plugin alongside Issues/Campaigns/Attention, backed by per-project `docs/outreach/` consistent with `docs/issues/`; Beeper Desktop runs on the maintainer's Mac and syncs daily via bb automation (maintainer, @thread:thr_2hd2kf9r28).
- 2026-11-21: mockup in @thread:thr_2hd2kf9r28 approved ("yes, this looks good"), with three refinements: Queue items can be marked "handled" immediately without waiting for sync (plugin-storage hash like Attention), a single Discuss action replaces separate Critique/Draft buttons, and uncontacted leads (`stage: candidate`) live in a Candidates tab rather than Queue (maintainer).

## tasks

Implementation is partitioned into [[projects/mlegls-pi/issues/outreach-vault-format-and-daily-sync]] and [[projects/mlegls-pi/issues/tracker-outreach-panel-for-project-vaults]]. Both build against the `snapshot --json` contract above and can proceed in parallel.

After both children reach their target checkouts, run the combined first use above in a disposable bb project using the new `outreach.ts` CLI and rebuilt tracker plugin. Record the rendered Queue/Candidates/Hypotheses views, Mark handled + resurface on re-sync, and Discuss mention handoff. Update `docs/guide/outreach.md` and [tracker README](../../../bb-plugins/tracker/README.md) with the verified entry points.

The plugin child works in its own `bb-plugins` worktree from `main` and declares its foreign checkout and commits in the handoff; supervisor @thread:thr_dfgkcug6jp owns merging those commits into `/home/mlegls/dev/bb-plugins` main when completion holds and removing the foreign worktree, leaving the `obsidian-at-home` submodule untouched.

## Result

done. All four stories held. The independent Hypotheses screenshot caught the plugin swap; the corrected packet uses the implementer’s same-build capture, which shows the decision bar and the expected reply count.

```yaml
commit: 06ef5c80
stories:
  - {story: "Mock Beeper reply reaches Ada’s vault log and BB Queue", outcome: held}
  - {story: "Mark handled clears Ada; a second synced reply resurfaces her without reload", outcome: held}
  - {story: "Candidates are ordered by priority and Hypotheses counts the synced reply", outcome: held}
  - {story: "Discuss carries Ren and the linked hypothesis into the thread", outcome: held}
evidence:
  path: docs/attachments/outreach-conversations-in-the-bb-tracker/index.md
  visual: true
  shots:
    - docs/attachments/outreach-conversations-in-the-bb-tracker/drive-first.jpg
    - docs/attachments/outreach-conversations-in-the-bb-tracker/drive-handled.jpg
    - docs/attachments/outreach-conversations-in-the-bb-tracker/drive-resurface.jpg
    - docs/attachments/outreach-conversations-in-the-bb-tracker/drive-candidates.jpg
    - docs/attachments/outreach-conversations-in-the-bb-tracker/hypotheses.jpg
    - docs/attachments/outreach-conversations-in-the-bb-tracker/drive-discuss.jpg
fixed:
  - Corrected the Hypotheses evidence link; preserved the unavailable-panel capture with its actual meaning.
  - Clarified the global badge count and how to submit Discuss on the current branch after sync.
checks:
  - Replayed seed, check, first sync, duplicate sync and second reply. Duplicate sync preserved Ada’s queue hash; the second reply changed it.
tests: []
filed:
  - "[Keep the BB plugin candidate stable during drive](docs/issues/keep-bb-plugin-candidate-stable-during-drive.md)"
changes:
  - No structural refactor. The combined journey uses the CLI snapshot; the plugin’s separate reader supports the explicitly required no-skill installation.
caveats:
  - The plugin invalidates the Outreach query every 30 seconds to discover new vaults, follow-up dates and sync metadata beyond the Markdown watcher.
```

Evidence: [docs/attachments/outreach-conversations-in-the-bb-tracker/index.md](../attachments/outreach-conversations-in-the-bb-tracker/index.md)
