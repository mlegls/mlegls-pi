---
next: done
part-of: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
---

record at spawn, in the session header: agent name, run, handle, parent session id. log board reads and acks with the reader's identity, not only sends. add a subscription-vs-metered flag per model and a price for luna so pool accounting ("[[projects/mlegls-pi/issues/pool-aware-routing]]") and cost audits are honest.

done: the audit queries in [[projects/mlegls-pi/research/orchestration-audit-2026-09-18]] can be rerun without inferring workers from directory names or grepping sessions for reads. from the instrumentation gaps section there.

## answer

spawn provenance: \`lib/wm.ts\` exports PI_WM_AGENT/RUN/HANDLE/PARENT_SESSION on the workmux agent command; \`extensions/session-meta\` writes them as a \`session-meta\` custom entry at session_start (pi has no header hook). board reads and acks go to \`reads.jsonl\` beside \`log.jsonl\` with {session,name,cwd}. billing/pool per model is \`modelOverrides\` in \`~/.pi/agent/models.json\` (codex, anthropic, xai subscription; deepseek metered; unlisted providers metered by convention); luna's price is pinned there. the audit's "luna has no price" was stale.
