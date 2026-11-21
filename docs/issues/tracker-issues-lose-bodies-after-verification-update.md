---
stage: "ticket"
assignee: "agent:auto-routine"
author: "session:01a1e536-4fbb-76a0-a863-0a919392dbbf"
priority: 2
---
On 2026-11-16, Common Concept handler @thread:thr_pgvpie4f2v read the global tracker with `bun ~/.pi/agent/skills/tracker/scripts/issues.ts text joined-5000-profile-practice-and-map-stay-loading` and `text verify-full-5000-card-profile-opening`. Both returned YAML frontmatter and no body, twice. The parent and verification ticket remain at stage ticket. Their decisions, acceptance and remaining tasks are unavailable through the tracker.

The preceding worker's handoff says it updated both bodies with the failed joined Practice verdict and remaining work. Its retained packet at `/home/mlegls/dev/mmon/concept__worktrees/verify-full-5000-card-profile-opening-implement-10/docs/attachments/joined-5000-profile-practice-and-map-stay-loading/joined-verdict.md` is intact at commit `68a6c7308a83a357eac3428c2b914d8d1486397e`; the handler's base `68c8b1c46a51ca892b1eb94e63e4f69cb24e786b` predates that packet. The sibling `open-profile-and-practice-from-compact-review-readings` still has its body. The handler has not written either empty issue. The write calls and cause of loss have not been recovered.

Tried: repeated global `text` reads; read the retained worker packet and related startup contracts; searched the Concept and mlegls-pi trackers for an existing body-loss report. `concurrent-tracker-updates-revert-each-others-fields` concerns stale concurrent field updates, whose cause is not established here. Recall retains acceptance summaries, but its cited source-entry reads returned not found.

Workaround: preserve the failed product evidence and escalate contract recovery to the parent rather than reconstructing decisions from a handoff. The owning tool is the mlegls-pi tracker CLI and its publication path. Investigate the last two body updates and recover the contracts, then decide whether the caller, stdin handling or publication lost the text. There is no established fix yet.
