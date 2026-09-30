---
priority: 4
stage: idea
assignee: agent
---

The five orchestration-audit analyses each re-implement the same reading of `~/.pi/agent/sessions` and `~/.local/share/pi-board/log.jsonl`:

- per-session usage sums over `message.usage` (`cost.total`, `input`, `output`, `cacheRead`, `cacheWrite`) and `model_change.modelId`: `docs/analysis/orchestrate-rework-effect/metrics.py` (`session_usage`), `docs/research/role-model-spikiness.py` (`read`), `analysis/cache-read-fence-knee/scan.py` (`parse`);
- tool-call counting over `content[].type == 'toolCall'` in the same three;
- `datetime.fromisoformat(ts.replace('Z', '+00:00'))` in `board_corr.py`, `analyze.py`, `role-model-spikiness-acceptance.py`; whitespace `norm` in both `decision-broadcasts-read` scripts;
- board-log read loop with `json.JSONDecodeError` skip in `board_corr.py`, `metrics.py`, `extract.py`, `role-model-spikiness-acceptance.py`.

Older one-off scripts in `docs/research/` (`bash-exec-cache.py`, `connectome-om-costs.py`, `interactive-context-om.py`, `ingress-economics/audit.py`) do the same again.

Each script differs in what it keeps (per-call series vs per-session totals vs handle-to-cwd maps) and each has committed outputs pinned by tests, so a merge is not tidying: it would be a small stdlib-only `session_log.py` (iterate session files with parsed records; iterate board rows) that the scripts import. Worth doing when the next audit script would otherwise be the sixth copy.
