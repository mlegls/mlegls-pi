---
next: measure
part-of: "[[projects/mlegls-pi/issues/agentic-setup-reorg]]"
---

External filesystem/web/tool data enters the parent through exec display: chunk it,
Jev-score relevance to the current work, show useful pieces, and retain omitted
originals behind a visible page table. Never change retained tool values.

## Implemented — 2026-09-20

`lib/ingress.ts`: lossless lexical chunking, bounded concurrent Noul scoring,
conservative retention (`p >= .2`), recoverable content-derived IDs, decision/pull
events. `create({chunk, score, threshold, record})` is the importing API.

Exec applies it to `show`, `show.large`, console aliases, and notification results.
`show.raw(...)` bypasses scoring; `show.pull(id)` recovers an omitted original.
Loaded skills/API help and images pass through. Small text and unified diffs stay
whole. Missing credentials/scorer errors/timeouts keep original text with a notice.
The query comes from the compaction-applied conversation tail plus current cell.
Raw process output and interrupted-shell captures are UI-only diagnostics, not a
second model ingress. Other extensions/BB direct injections remain outside this hook.

Guide and limitations: `docs/ingress.md`. Reload the host extension to activate.

## Verification

- Real extension runner + session manager + fresh kernel, live Jev: a source read
  kept the cancellation section (p=.91), omitted the garden section (p=.05), and
  preserved output order. Pull/raw, explicit skill passthrough, notification
  filtering, missing-key fail-open, UI-only stdout/stderr and interrupted-shell
  diagnostics all driven successfully. Plain-text smoke: p=.95/.02 in ~2 seconds.
- `env -u BB_THREAD_ID bun test`: 196 pass, 2 skip, 0 fail. The ordinary BB-mode
  run has seven board-related failures because those tests expect board enabled.
- `bunx tsc --noEmit`: the five existing Exa/session/system-prompt errors; none
  in changed files.
- `scc-delta.sh ebb8431 extensions/exec`: +54 code, +31 complexity. New
  `lib/ingress.ts`: 107 code, 15 complexity. Total scoped delta: +161/+46.

## Remaining

[[projects/mlegls-pi/issues/reranker-eval]] must measure misses/latency on real
session ingress before treating .2 as calibrated. `exec-ingress` session entries
record thresholds, query hashes, chunk IDs/labels/sizes/probabilities, and pulls.

The initial chunker is lexical, not AST-aware or specialized for build/log blocks.
Measure this baseline before paying for richer chunkers. Page storage is kernel-local;
reset expires it. Raw/pull still obey the existing display caps.

Decisions:
- 2026-09-20: use exec display as the external-data boundary, not a filter over
  user messages or loaded instructions. Autoread is independent and composes
  through the same display path. Prototype shipped; calibration remains measure.
