# Orchestration audit — 2026-09-18

Scope: pi sessions under `~/.pi/agent/sessions` from 2026-09-01 to 2026-09-18 (694 sessions,
220 of them workers identified by `__worktrees-<handle>` in the session directory name),
the board log at `~/.local/share/pi-board/log.jsonl` (1194 messages), and pi's per-message
`usage.cost`. Costs are pi's list-price estimates; astra/sol/terra ride the codex subscription
and fable/opus/sonnet the anthropic one, so for those the real constraint is weekly pool
budget, not dollars. Tokens are the honest unit. The `wm` worker era is 09-14..09-16 only,
and the agent roster changed daily in that window.

Method: session JSONL parsed per message; tool calls classified by tool name and, for
`bash`/`exec`, by command text. "Referenced later" means the file's basename appears in a
later assistant text, edit, write, commit, or spawn prompt in the same session — string
matching, so it overcounts use for generic names and cannot see that a used file was mostly
irrelevant lines.

## Spend

| | sessions | cost |
|---|---|---|
| parent (non-worktree) | 474 | $4841 |
| worker | 220 | $1389 |

Parent spend per day fell ~5× after workers arrived (09-08..12: $400–800/day; 09-14..16:
$70–130/day), but total on 09-14 was unchanged ($876, of which workers $785). Totals fell on
09-15 ($608) and 09-16 ($193) as opus left the worker roster. The saving so far came from
routing, not delegation.

Worker spend by model (09-14..16):

| model | sessions | cost | median $ | median tool calls | median minutes | median turns |
|---|---|---|---|---|---|---|
| claude-opus-5 | 40 | $849 | 13.4 | 130 | 54 | 2 |
| gpt-6-astra | 92 | $270 | 1.6 | 21 | 13 | 1 |
| claude-sonnet-5 | 31 | $163 | 2.1 | 112 | 24 | 1 |
| grok-4.6 | 9 | $80 | 4.4 | 127 | 69 | 3 |
| gpt-5.6-terra | 15 | $19 | 1.4 | 72 | 219 | 3 |
| deepseek flash (both) | 15 | $7 | 0.2 | 119 | 25 | 2 |
| glm flash | 17 | $1 | 0.0 | 42 | 22 | 1 |

The expensive shape: `transcript-capture-feasibility` (558 tool calls, 27 turns, 18.5 h
elapsed, 232M cache-read tokens, $137) and `hook-emission-snapshots` (406 calls, 160M
cache reads, $109). Cost is Σ(context at call i) over calls: long context × many calls, with
each parent steer re-paying the prefix. The context fence bounds context fraction, not
cumulative reads.

Effective rates from usage ($/M input, output, cache read; all-in $/Mtok):
astra 10/50/1.00 → 1.61; fable 5.1 10/50/0.25 → 0.88; opus 5 5/25/0.50 → 0.69;
sonnet 5 2/10/0.20 → 0.26; terra 2/12/0.20 → 0.29; grok 4.6 2/6/0.50 → 0.57;
deepseek flash 0.15/0.60/0.02 → 0.04. Output is 0.3–0.4% of input for every model:
agentic reading is input-priced. Luna has no price in pi (96 sessions at $0).

## Board outcomes

217 worker topics: 201 reached `done`, 16 never did, 33 checkpointed, 9 checkpointed ≥2×.
452 `decision` tags vs 363 `done` and 34 `ack` board-wide. The never-done and
multi-checkpoint sets coincide with the top-cost sessions and are one run,
`concept/factor-finish/*` (`finish-materials`: 26 decisions, 5 checkpoints, never done;
`finish-private-hub`: 6 checkpoints). That run predates the 09-15 orchestrate rework
(`a7f7a98` in system-config); 09-16 shows 26 workers, $124, no never-done topics — one day,
not evidence yet.

`autoread` ran 4 times in three days against ~120 worker spawns.

## What enters parent context

294 parent sessions since 09-01, 76 MB of tool results:

| kind | share |
|---|---|
| `read` tool | 28% |
| `bash` cat/sed/head/tail | 21% |
| `bash` rg/grep/find/ls | 8% |
| exec read/grep | 2% |
| **reading total** | **~60%** |
| git diff/log/status | 7% |
| subagent/session reports | 6% |
| curl/gh/exa | 8% |
| edits, tests, board, wm | ~8% |

77% of `read` calls are whole-file. Result sizes p50 2.9 KB, p90 13 KB, p99 44 KB.
0.36 re-reads per unique file. Of 3648 unique files read with `read`: 58% later acted on,
18% only mentioned in prose, 24% never referenced again.

## Coordinator sessions

48 sessions that spawned workers account for $2252 of $3537 parent spend. Split at first spawn:

| | before | after |
|---|---|---|
| reading | 3.7 MB | 18.6 MB |
| cost | $125 | $2134 |
| tool calls | 1443 | 11136 |

After the first spawn, by tool-result bytes: file reads in the main checkout 45%, other bash
13%, child reports and coordination 11% (2870 calls averaging 1.3 KB), `git diff` on main
11%, net 6%, search 6%, edits 3%; worker-branch reads and diffs under 1%. 1218 edit calls
happen after the first spawn: coordinator sessions hack in place and read what workers
landed after merge.

Child context enters the parent by push: subscribed board messages are injected whole
(body and `data`) as followUp turns (`extensions/board/index.ts`). The earlier `subagent`
tool returned the child's final output as the call result.

## Instrumentation gaps

- Sessions do not record agent, run, handle, or parent session; workers were inferred from
  directory names and models from `model_change` events. `run-history.jsonl` names agents
  but is from the previous roster.
- The board log records sends only, so whether a message was read is unanswerable without
  grepping sessions.
- No subscription-vs-metered flag per model. (luna was priced by the time of the audit; the $0 figure came from an earlier catalog.)
