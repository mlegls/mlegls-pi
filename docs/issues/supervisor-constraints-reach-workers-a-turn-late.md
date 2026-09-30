---
stage: idea
assignee: agent
priority: 2
author: session:01a0f065-abaf-776c-bc8b-419cb9b312e4
---

Constraints that the supervisor sends by `ab mail` reach a worker only after the turn it is already in, so a restriction on an action that is already under way arrives too late. On 2026-09-30, during [[projects/mlegls-pi/issues/archive/tracker-obsidian-rollout]]:

- "The live vault is read-only; don't re-run prepare" arrived after the redispatched worker had run `live-setup.ts prepare` on `~/obsidian` twice and driven the shared window. It then correctly asked for an owner disposition.
- The same note sent to drive arrived after drive had finished, having run prepare a fourth time.
- review-1 received it after planning, and still ran pin/trust steps in a second Obsidian instance against the live vault.

A related gap is live-target tickets. The rollout story told drive/review to "build and prepare from the committed checkout" against the user's real vault, so each verification phase redeployed the live target (4 backups). Neither the ticket format nor the roles can express "live target: inspect, don't redeploy". The same problem arises on any ticket whose first use is the user's own setup.

Possible shape: per-ticket constraints (a frontmatter field or a section the loop reads) that `lib/jobs/supervise.ts` puts in every phase's first prompt, instead of relying on mail racing a running turn.
