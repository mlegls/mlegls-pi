# Were factor-finish decision broadcasts read? (run 2026-09-14..15)

Ticket: `docs/issues/decision-broadcasts-read.md`. Hypothesis under test: "`decision` broadcasts
are read … 34 acks vs 452 decisions suggests not."

**Verdict: false as stated.** 114/133 (86%) factor-finish decisions have hard evidence of reaching
at least one peer — 112 by pull (peer's own `board_read`/exec read returned the decision body or id),
42 by wake-push injection; 40 of those by both. Median pull latency 13.9 min from decision to first
peer read; push latency 0.7 min. 47% of decisions reached ≥3 peers. The channel was not dead weight;
acks were simply the wrong instrument for this run shape (see below). The real failure is a
19-decision dead tail in the run's last ~4.5 hours, with a concrete mechanism.

## Corpus corrections

- 452 was the board-wide window count (I reproduce 439 decision-tagged messages in 09-14..09-15).
  Factor-finish-scoped: **133 decisions** (tags ∋ `decision`, topic mentions `factor-finish`),
  window 09-14T15:51Z..09-15T18:23Z, over 121 topics (434 messages).
- The 34 acks reproduce exactly: 34 ack-**tagged log messages** board-wide in the window (5 on ff
  topics). Acks-as-message were a habit of two earlier subruns that day (hook-snapshots,
  browser-flattening), not of factor-finish. The machine ack ledger (`reads.jsonl`) didn't exist
  until 09-18T16:13, so "reads ≈ acks" could not have been visible in the log at all.

## Evidence classes (per decision, reader ≠ sender, ts ≥ decision ts)

- **pull** (n=112): decision id in a peer's `board_read` result set, or decision body verbatim in the
  tool result of a peer's `board_read` / exec `board.read`. Strong: the board returned it to them.
- **push** (n=42): wake-subscription injection (`custom_message` board record, `[board] <id> …` +
  whole body) into a peer session. Counted as read by construction, flagged push not pull.
  40 of 42 also pulled; 2 push-only.
- **neither** (n=19): no pull, no push, no relay anywhere.
- Relays (ticket's limit): decision bodies appear in **zero** spawn prompts and **zero**
  user/assistant conversation text corpus-wide; exactly 1 decision body was quoted in a non-sender's
  `board_send`. This run's propagation was essentially all board-mediated pull/push — no
  parent-restatement ambiguity in practice.
- Excluded from headline: topic-matching polls whose returned ids are unknown or don't include the
  decision (would add ~0: the 19 "neither" have no topic-matching poll either), and body-in-bash-tool-
  result (jq/grep over log.jsonl; rare, 19 occurrences — a read of the log, not the board).

## The dead tail, and why

All 19 unreached decisions sit in the closing hours on two subtopics:
`…/finish-private-hub` (8, 09-15T11:52..13:37) and `…/finish-hub-remainder` (11, 14:09..16:09).

Mechanism: after each topic's last exact-topic read, the only peers still polling used the one-segment
glob `topic/*` — which does **not** match messages posted on the base topic itself. ui-lifecycle
polled `finish-private-hub/*` at 12:13 (6 min after the 12:07 decision) and url-guard polled
`finish-hub-remainder/*` at 14:09:20 (11 s after the 14:09 decision); both missed by construction.
`**` would have matched; nobody used it there, and by then no wake subscriber remained on either
topic. The broadcast didn't fail; the readers' topic selectors did (or: the parent kept posting
thread-tail decisions to a base topic whose audience had moved on).

## finish-materials reconciliation

Ticket: "26 decisions, 5 checkpoints, never done" — confirmed exactly (32 messages, 0 `done`).
All 26 decisions were reached (24 pull, 2 push-only). Its stalled completion was not an
unread-broadcast problem.

## Comparison the ticket asked for

Per-decision peer-reach distribution (pull ∪ push):
`{0:19, 1:33, 2:19, 3:5, 4:3, 5:12, 6:11, 7:7, 8:6, 9:4, 10:6, 11:3, 12:3, 13:2}` —
median reach 2 peers among reached decisions. Reads (114) ≫ acks (34, and only 5 ff-scoped):
the broadcast channel carried the coordination; acks measured a different, mostly-unused custom.

## Limits

- Pull evidence requires the body/id inside a stored tool result. A peer that read via bash
  (curl/jq of the log) shows only in the excluded log-grep class; a peer that read and whose
  session file was lost/rotated is invisible. So 84% is a floor.
- Push = wake-injection seen in the session file; a push to a session whose file is gone is
  undercounted the same way.
- Session grep cannot distinguish "read the board" from "read a restatement" — but restatements
  are independently near-zero (above), so the distinction doesn't bind for this run.
- Topic matching for polls treats `*` as within-segment and `**` as multi-segment (board semantics
  as used in the corpus). Base-topic/glob mismatch only matters to the dead-tail narrative, where
  the two stray polls are shown directly.
- The corpus is live-appending; counts are from one extraction pass (2026-09-30) — ±1-2 events on
  re-run as later-era sessions grow.

## Reproduce

```
python3 analysis/decision-broadcasts-read/extract.py   # ~4 min; greps+parses ~/.pi/agent/sessions
python3 analysis/decision-broadcasts-read/analyze.py   # prints summary above; writes coverage.json
```

Inputs: `~/.local/share/pi-board/log.jsonl`, `~/.pi/agent/sessions/**/*.jsonl` (no backend restart).
Committed: `coverage.json` (per-decision evidence with reader sessions/ts), `pushes.json`,
`events.json`+`text_occ.json`+`frags.txt` regenerate from the raw corpus (not committed).
