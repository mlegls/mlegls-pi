# role-model-spikiness: first-use drive

Tested revision: `aa3946d07680106f55e3f76fdaefdf9d688ddea2`.
Mode: supervised drive of a static research deliverable, not an implementation audit. No source, diff, tests or fixtures read; no product repairs.

## Before first use — 2026-09-30

Entry point supplied: repository plus local session and board JSONL. Deployment: static Markdown research in this worktree; no service or ports. Persona: local reader evaluating routing evidence; existing filesystem access, no additional authentication. State: existing 09-01..09-22 sessions and board log, read-only. No seeding authorized or necessary. The worktree is at the implementer's supplied commit and contains the named research document. The handoff supplied no executable entry point.

Predictions from the ticket's requirements (recorded before opening the research document):

1. **Corpus / matching.** I expect a discoverable inventory covering 09-01..09-22, model identification from session records, explicit comparable-target matching, and a checkable count of cross-model pairs separately for review and verify-story. If fewer than about five defensible pairs exist, I expect the report to say the corpus cannot answer rather than rank models from insufficient data.
2. **Measurements / spikiness.** I expect cost, turns and tool-call counts for each pair, and per-role medians and within-role spread at a stated fixed shape. I should be able to follow a session citation and reproduce a number without reverse-engineering an implementation or finding ephemeral scratch files.
3. **Parent acceptance.** I expect each selected pair to have a trace to the parent's next accept/merge versus checkpoint/respawn action, not merely the child's approval. I expect missing observations to remain unknown.
4. **Routing.** I expect a conclusion linked to the current routing policy, distinguishing observed task variance from a causal model effect and marking any unsupported role/model comparison as untested.

Contamination boundary: the mandatory board read returned the implementer's summary and peer corpus corrections; the ticket itself includes its answer. Those summaries were visible before these predictions. Predictions above come from the ticket requirements, not a claim of blindness to the headline result.

## Session log

- Setup inspection: `git rev-parse HEAD` returned the revision above; initial `git status --short` was empty. The ticket links `docs/research/role-model-spikiness-2026-09-30.md`, which exists. Read the verification evidence rules and mandatory peer board before touching the packet/ticket seam. No deployment selector, browser, server or external process was reused or started.

