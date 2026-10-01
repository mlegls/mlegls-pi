---
stage: ticket
assignee: agent
priority: 2
author: session:01a0f065-abaf-776c-bc8b-419cb9b312e4
part-of: "[[projects/mlegls-pi/issues/reconcile-the-execution-tree-with-lazy-exception-handlers]]"
---

Carried to the reconciler 2026-10-01: a resolution's `note` reaches only the next launched phase, and an `answer` is still mail racing the running turn. In the contract below, `ab supervise constrain` becomes a reconcile tool and "job state" the reconciler's state file.

Constraints that the supervisor sends by `ab mail` reach a worker only after the turn it is already in, so a restriction on an action that is already under way arrives too late. On 2026-09-30, during [[projects/mlegls-pi/issues/archive/tracker-obsidian-rollout]]:

- "The live vault is read-only; don't re-run prepare" arrived after the redispatched worker had run `live-setup.ts prepare` on `~/obsidian` twice and driven the shared window. It then correctly asked for an owner disposition.
- The same note sent to drive arrived after drive had finished, having run prepare a fourth time.
- review-1 received it after planning, and still ran pin/trust steps in a second Obsidian instance against the live vault.

A related gap is live-target tickets. The rollout story told drive/review to "build and prepare from the committed checkout" against the user's real vault, so each verification phase redeployed the live target (4 backups). Neither the ticket format nor the roles can express "live target: inspect, don't redeploy". The same problem arises on any ticket whose first use is the user's own setup.

Possible shape: per-ticket constraints (a frontmatter field or a section the loop reads) that `lib/jobs/supervise.ts` puts in every phase's first prompt, instead of relying on mail racing a running turn.

ticket contract, 2026-09-30: an owner can attach constraints to a supervised child that every later phase gets in its first prompt, not only by mail racing the current turn. Design (decided 2026-09-30): `ab supervise constrain <ticket> <child> TEXT` records the constraint in the job state, mails the current worker, and the loop appends all recorded constraints to every later phase's launch prompt (drive, review, redispatch, consolidate). Don't store them in the ticket file, because the child's branch owns that file while it's live. Also document in the `supervise` skill that a ticket whose first use is the user's own live setup should say in its body what drive and review may and may not redo there. First use: constrain a child mid-implement, and see the constraint in its drive and review prompts.
