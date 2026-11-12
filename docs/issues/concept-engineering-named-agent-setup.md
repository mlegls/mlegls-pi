---
stage: "done"
assignee: "agent:auto-routine"
priority: 2
author: "session:01a1ce05-15a3-7191-b6d9-27abd097297f"
part-of: "[[projects/mlegls-pi/issues/a-name-is-an-agent-with-its-soul-skills-and-life]]"
---
goal: Concept Engineering's copied soul and private skill are versioned in the Concept repository and registered on the Beelink; its shared facts are global notes and its Sunday routine starts the same named agent through BB. This is the setup in [[projects/mlegls-pi/issues/a-name-is-an-agent-with-its-soul-skills-and-life#the Concept agents' files]], for [[projects/mlegls-pi/issues/concept-engineering-runs-as-a-life-on-the-beelink]]. The week of ordinary use and the maintainer's judgment remain that trial's work.

## shape

Follow the parent's exact copy choices and model list: `agents/concept-engineering/SOUL.md`, `agents/concept-engineering/skills/engineering-taste/`, and the registry in system-config. Keep Hermes's source files intact; only pause its migrated cron job. Other profiles and their bundled, connector and bot-building skills remain where they are.

The repositories are `~/dev/mmon/concept` for agent files and `~/.config/system-config` for the registry; inspect their current state and repository rules before changing them. Commit each repository's owned files there and report its revision and landing state alongside this ticket's evidence. The registry points to the Concept main checkout, so sessions in other repositories resolve the same files.

Convert the four MEMORY entries and USER facts to notes of at most 280 bytes per line, all global, from a session attached as Concept Engineering. Leave machine-wide notes settings off. Use [[projects/mlegls-pi/issues/import-hermes-sessions-as-a-lifes-first-messages]]'s delivered import command to prepare its Hermes history before this first live manifestation; conversion code belongs to that issue.

Replace the Hermes Sunday 09:00 'Reconcile docs/principles with mlegls’s answers' routine with a BB automation in the Concept project on `agent/concept-engineering`, preserving the existing schedule's timezone and prompt. Pause the Hermes routine and retain its definition for the trial's reversal.

Confirm the live registered model, soul and private skill from a BB session, notes available with the global settings still off, and the automation's project/model/schedule plus Hermes's paused state. Hand the runnable named agent and these receipts to the trial owner; the parent identifies concept-strategy as owner.

The setup is the first place the imported history is summarised by a real model, so its receipts include, on the real `/concept-engineering` life after the import and its first session: the longer imported messages (161 at review) have their summaries, with none left unbuilt once the compactor has drained; asked about something specific from its Hermes Bot Chat, it answers from it, and `zoom` on that summary reaches the copied message and its Hermes source; if `life: compaction failed: empty reply` appears, the failing call's stopReason is captured into [[projects/mlegls-pi/issues/life-first-use-compaction-empty-reply-warning]]. A summary left unbuilt or a wrong answer means the setup isn't ready to hand over; that is agents' work, not a question for the owner (decision in [[projects/mlegls-pi/issues/concept-engineering-runs-as-a-life-on-the-beelink]], 2a81a484).

## Result

done. The Concept Engineering setup holds on live state, and I made no repairs. I appended a review section to the driver's packet; it is committed as `90ea9236` and Hermes's source files were left alone.

What I checked:
- **Agent files:** Concept main `76a71eb1e` has `agents/concept-engineering/SOUL.md` with model `anthropic/claude-fable-5-2:medium`. It also has the `engineering-taste` skill and its reference, with a clean working tree. `origin/main` contains the commit.
- **Registry:** system-config `e35f76e` is a three-line commit pointing `agents` at `~/dev/mmon/concept/agents`. `~/.pi/agent/settings.json` links to that file and has no notes setting.
- **Notes:** the seven imported lines are 155–244 bytes each, under the 280 limit.
- **Automation:** BB `auto_1yjcfelkko8` is enabled in `proj_fgz6kudzrk` on `agent/concept-engineering`, medium, `0 9 * * 0` Asia/Shanghai. Hermes job `06c0f323b60e` is paused with its definition and schedule retained.
- **Tracker friction:** `life-compactor-lease-outlives-its-builder` stays an idea, waiting on the choice it names (release the lease on failure, add a heartbeat, or let a sibling take over after a pid check). `life-first-use-compaction-empty-reply-warning` stays an idea. The `empty reply` warning did not appear in this setup, so there was no stopReason to capture.
- **Not re-run:** I did not re-run the thread-level recall, zoom or summary checks. I relied on the driver's receipts for those.

```yaml
commit: 90ea9236
stories:
  - story: Registered Concept Engineering manifests with its soul, private skill and model
    outcome: held
  - story: Global notes remain available with machine-wide notes settings off
    outcome: held
  - story: Imported Hermes history supplies specific recall and original-message provenance
    outcome: held
  - story: Imported summaries are ready after compaction drains
    outcome: held
  - story: BB Sunday automation replaces the retained paused Hermes routine
    outcome: held
evidence:
  path: docs/attachments/concept-engineering-named-agent-setup/index.md
  visual: false
  shots: []
tests: []
filed: []
caveats:
  - "system-config e35f76e is a local commit, unpushed. Its settings.json has other uncommitted edits from before this work."
  - "The eight initial summaries waited about 10 minutes on abandoned compactor leases, so the first session had to stay alive until they expired (life-compactor-lease-outlives-its-builder)."
  - "The Sunday routine has not run. The week of ordinary use belongs to Concept Strategy."
```

Evidence: [docs/attachments/concept-engineering-named-agent-setup/index.md](../attachments/concept-engineering-named-agent-setup/index.md)
