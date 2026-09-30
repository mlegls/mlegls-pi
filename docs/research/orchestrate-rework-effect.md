# Orchestrate rework effect — 2026-09-30

Question, from [[docs/issues/orchestrate-rework-effect]]: did the orchestrate
rework (`a7f7a98` in system-config, 2026-09-15 11:33 +0800, "Route routine
work explicitly and reclassify at phase boundaries") work? It changed three
files: `agents/research.md:9` (verify conclusions against the cited source),
`skills/…/dispatch/SKILL.md:14,16` (`auto-routine` executor class for
straightforward work that still needs discovery; re-dispatch at phase
boundaries, "a frozen result is a handoff point"),
`skills/…/orchestrate/SKILL.md:10` (choose each unit's executor through
`dispatch`; only open units spawn as `auto`).

Corpus: board sends 2026-09-14..09-21 in `~/.local/share/pi-board/log.jsonl`
(1234; zero sends on 09-17 and 09-22, so the board era ends at the 09-22
scope line), joined to `~/.pi/agent/sessions` per-message `usage.cost.total`
via `from.session`. run = board topic prefix (hand-curated, 30 prefixes);
worker = sender cwd under `__worktrees/`, handle = its basename; nested topic
= depth ≥ 2 under the run (a worker dispatching a worker). Numbers below come
from `docs/analysis/orchestrate-rework-effect/metrics.py` (raw table:
`metrics.tsv` next to it). Baseline = runs starting 09-14..09-15; after =
09-16..09-21.

## Check against the 2026-09-18 audit

Over its corpus (sends through 09-16 = 1194): worker topics 217 =,
decision 452 =, ack 34 =, checkpointed 33 =, checkpointed ≥2× 9 =, opus
worker sessions 40 =. Done/never is rule-dependent and its rule is not
recorded: handle-level done 190 / never 14, topic-level 192 / 26, done
anywhere-in-subtree 197 / 21, vs its 201 / 16. Two corrections to that
audit: "09-16 shows … no never-done topics" is false at handle level —
`materials-closeout` (09-16) has 2/6 never-done handles, and its lead
handle posted `done` at 03:00 four minutes after the last open worker
checkpoint; and its per-day worker costs ($785/$608/$193) are whole-day
totals, not per-run.

## Per-run result

| run | era | window | sends | workers | done/never | ckpt | nested | parent cwds/sessions | worker $ |
|---|---|---|---|---|---|---|---|---|---|
| concept/hook-snapshots-0914 | before | 09-14 2.7h | 152 | 6 | 6/0 | 1 | 0 | 1/2 | 178.84 |
| concept/transcript-capture-feasibility | before | 09-14 5h | 67 | 3 | 2/1 | 0 | 0 | 1/2 | 144.31 |
| concept/browser-flattening | before | 09-14 3.2h | 26 | 4 | 4/0 | 2 | 0 | 1/1 | 49.12 |
| concept/backend-finish | before | 09-14 45m | 17 | 3 | 3/0 | 0 | 0 | 1/1 | 11.02 |
| concept/test-pruning-0914 | before | 09-14 25m | 6 | 2 | 2/0 | 0 | 0 | 0/0 | 8.26 |
| concept/factor-finish | before | 09-14 15:51–09-15 18:27 | 434 | 115 | 107/8 | 37 | 67 | 1/1 | 627.36 |
| orch/model-175 | before | 09-15 3h | 45 | 9 | 9/0 | 1 | 3 | 1/1 | 138.09 |
| audit/pi-routing | before | 09-15 6m | 22 | 3 | 3/0 | 0 | 0 | 1/1 | 2.50 |
| fix/board-delivery | before | 09-15 8m | 11 | 2 | 2/0 | 0 | 0 | 1/1 | 1.33 |
| experiment/compression | before | 09-15 9m | 3 | 3 | 3/0 | 0 | 0 | 0/0 | 0.43 |
| orch/exec-kernel | before | 09-15 14m | 33 | 3 | 3/0 | 0 | 0 | 1/1 | 5.06 |
| orch/exec-expand | before | 09-15 33m | 55 | 7 | 4/3 | 3 | 1 | 1/1 | 8.03 |
| orch/forum-search | before | 09-15 25m | 7 | 2 | 2/0 | 0 | 0 | 1/1 | 18.05 |
| orch/exec-next | before | 09-15 13m | 54 | 5 | 5/0 | 0 | 0 | 1/1 | 13.69 |
| orch/exec-presentation | before | 09-15 13m | 51 | 4 | 4/0 | 0 | 0 | 1/1 | 9.61 |
| orch/dev-chat | before | 09-15–16 | 19 | 1 | 1/0 | 0 | 0 | 0/0 | 20.83 |
| orch/exec-frictions | before | 09-15 19m | 48 | 7 | 6/1 | 0 | 0 | 1/1 | 10.32 |
| orch/exec-runtime-core | before | 09-15 26m | 77 | 4 | 4/0 | 3 | 0 | 0/0 | 18.49 |
| verify-final (dispatch probes) | before | 09-15 | 6 | 0 | 0/0 | 0 | 0 | 3/3 | 0 |
| review/board-freshness | before | 09-14 1 msg | 1 | 0 | 0/0 | 0 | 0 | 1/1 | 0 |
| materials-closeout | after | 09-16 1.1h | 8 | 6 | 4/2 | 3 | 0 | 0/0 | 18.80 |
| orch/exec-frictions-0916 | after | 09-16 2h | 16 | 5 | 5/0 | 1 | 0 | 1/1 | 11.77 |
| concept/ui-polish | after | 09-16 1 msg | 1 | 1 | 1/0 | 0 | 0 | 0/0 | 2.22 |
| exec-state/test-migration | after | 09-16 1m | 3 | 1 | 1/0 | 0 | 0 | 0/0 | 1.06 |
| cm-frontier | after | 09-16 5.4h | 32 | 10 | 10/0 | 3 | 0 | 0/0 | 89.39 |
| reorg/0918 | after | 09-18 35m | 14 | 6 | 6/0 | 0 | 0 | 0/0 | 4.74 |
| frontier/0919 | after | 09-18–20 | 21 | 9 | 9/0 | 0 | 0 | 0/0 | 25.12 |
| vault/mlegls-pi | after | 09-20 1m | 2 | 2 | 2/0 | 0 | 0 | 0/0 | 0.03 |
| orca-probe | after | 09-21 1m | 3 | 0 | 0/0 | 0 | 0 | 2/2 | 0 |

Era totals (sessions deduplicated within era): before — 19 runs, 1127 sends,
177 worker sessions, $1260 worker / $421 parent (7 parent sessions), 38M
input / 2037M cache-read worker tokens; after — 9 runs, 100 sends, 40 worker
sessions, $153 / $22 (2 parent sessions), 8M / 324M.

## What moved and what didn't

Handle count, as the ticket defines it (distinct parent cwds dispatching
into the run): every run in both eras has exactly one, except the 09-21
orca-probe (2, already the paseo/orca era). "Runs since with exactly one
handle" is true and was already true — one orchestrator session per run even
on 09-14, where one session drove five runs. The rework's structural target
shows up one level down instead: nested dispatch. factor-finish has 67
nested topics (workers spawning workers, e.g. `patch-storage-closure` →
`transaction-cost-diagnosis`); no 09-16+ run has any. That is the mechanism
`a7f7a98` addressed (`auto-routine` for routine leaves; only open units
spawn as `auto`).

The never-done exemplar: factor-finish — 115 worker handles, 8 never done
(`finish-materials`, `finish-private-hub`, `final-drive`, `lifecycle-drive`,
`native-materials`, `public-hub-routes`, `runtime-u1-cursor`,
`u7b-browser-gate`), 37 checkpoint sends over 19 handles, 26.6h, $627 worker
cost of which opus is $374 (60%, 26 sessions). After era: never-done 2/40
handles (both in materials-closeout, closed over by the lead rather than
cost runaways), checkpoints 0–3 per run, longest run 5.4h, costliest
cm-frontier $89. Before-era means: $66/run (median $11); after: $17 (median
$4.74).

One more structural observation: the after-era coordinator is invisible on
the board. For six of nine after-runs no non-worktree cwd ever posts —
cm-frontier coordinates peer-to-peer between worker worktrees
(`flatten-leftovers`, `suite-handoff-review` post into sibling topics), and
board sends fell 12× (1127 → 100). The board stopped being the run spine in
the same window the rework landed; the two are not separable from this
corpus.

## Confounds (stated, not fixed)

- Opus left the worker roster on 09-16: 40 opus worker sessions before ($374
  of factor-finish alone), zero after. The per-run cost fall is bounded
  below by that alone; tokens, not dollars, are the honest unit for
  subscription models.
- Run-type mix differs: the after window is finish/cleanup runs
  (cm-frontier, materials-closeout) plus the 09-18 reorg, not greenfield
  campaigns.
- The 09-15 evening exec-* runs already ran under the reworked skill and
  still produced 4 never-done handles and 3 checkpoints in exec-expand —
  whatever the rework bought, it was not instantaneous.
- The routing changes (710bee5/869e6a7, 09-23, giving `supervise` an
  operating point in routing.md) postdate the whole board era and confound
  only the paseo-era comparison.
- Costs are pi list-price estimates; parent-session cost is whole-session,
  so runs sharing an orchestrator session double-count it in per-run parent
  $ (era totals deduplicate).

## Same question at larger scale

The paseo-era 09-23 campaign ([[docs/research/orchestration-audit-2026-09-23]])
answers the coordination half out of scope here: coordination was ~49% of
~$252, supervisor cost was mostly cache reads, no session used `compile`,
and ~50 workers were titled `undefined/…` because `dispatch` accepted a
missing `run` (`RegExp.test(undefined)`, fixed in `72b58e9`). One parent,
six sub-supervisors, ~95 workers — but the tree split by ticket lineage
rather than code seams and four coupled branches missed main after 4.5h.
