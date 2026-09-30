---
stage: done
assignee: agent
priority: 3
part-of: "[[projects/mlegls-pi/issues/archive/orchestration-audits]]"
---

hypothesis, from [[projects/mlegls-pi/issues/archive/orchestration-audits]]: `decision` broadcasts are read: in the factor-finish run, grep peer sessions for `board.read` on the run topic after each decision timestamp. 34 acks vs 452 decisions suggests not.

corpus: decisions from `~/.local/share/pi-board/log.jsonl` — `tags` containing `decision`, topic prefix `concept/factor-finish` (437 factor-finish mentions; `finish-materials` alone: 26 decisions, 5 checkpoints, never done). peers: 154 session files under `~/.pi/agent/sessions` mention `concept/factor-finish`, window 09-14..09-15. `~/.local/share/pi-board/reads.jsonl` exists but starts 09-18T16:13 — useless for this run; read-evidence is `board.read` tool calls (pi tool or exec command text) inside peer session jsonl. a subscription push injects the message whole into the parent session ([[projects/mlegls-pi/research/orchestration-audit-2026-09-18]], "Board outcomes" era) — count as read by construction, flagged as push not pull.

method: decision timestamps from log.jsonl; per decision, list peers that read the topic at ts ≥ the decision (session grep; ts from surrounding message records). report per-decision read counts and the fraction with ≥1 evidenced read; compare against the 34 board-wide acks. if reads ≈ acks, the broadcast channel is dead weight for this run shape.

limits: session grep sees pi tool calls and exec command text only — a peer that learned a decision via the parent's relay (restated in a spawn prompt) is indistinguishable from unread; record visible relays separately. no backend restarts: static jsonl only.

## Result

Answer: [report](../../analysis/decision-broadcasts-read/report.md) — hypothesis supported (114/133 decisions reached a peer), the dead-weight inference rejected. [First-use verification packet](../attachments/decision-broadcasts-read/index.md): CLI reproduction, observed story outcomes, frictions and replayable checks.

## Verification evidence

[Encounter and evidence](../attachments/decision-broadcasts-read/index.md).
