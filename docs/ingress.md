# Exec ingress

External information should reach the session in relevant pieces, without losing
access to the original. Exec applies `lib/ingress.ts` at display time, not read time.

## Use

Reload the extension (`/reload` or restart Pi) once to install the host context
handoff. A kernel reset alone does not reload the host extension. Jev uses the
existing `JEV_API_KEY` or Cloudflare credentials supported by `lib/decide.ts`;
no additional model subscription or provider routing is involved.

- `await show(value)`: render, chunk, score, then apply the display budget.
- `await show.raw(value)`: render without relevance scoring.
- `await show.pull("ing-…")`: recover an omitted original without rescoring.
- `show.large` raises the byte budget but does **not** bypass relevance scoring.
  Raw/pull obey the same cap; call `await show.large()` first to raise it.
- Console aliases and notification results use the same filter. User messages,
  explicit loaded skills (including their returned content blocks), API help, and
  image payloads are not relevance-filtered.

IDs are content-derived page references, **not edit anchors**. Source line/edit
anchors remain intact in retained and pulled text. Pages last until kernel reset,
interruption, or session navigation; retain source values if you need other views.
Normal truncation remains separate from relevance pruning.

## Prototype policy

The query is up to six recent user/assistant text messages from the active,
compaction-applied branch (12,000 characters), plus up to 4,000 characters of the
current cell. Thinking and previous tool-result bodies are not sent. Notifications
use the latest cell's query. No conversation context means no pruning.

The initial chunker is lossless and lexical: Markdown sections, top-level
source declarations, and paragraphs/blocks, bounded to 4,096 characters. Source
headers carry into labels. This is not yet an AST or specialized log chunker.
The importing API `ingress.create({chunk, score, threshold, record})` admits richer
chunkers and alternate scoring. A project `.pi/exec/ingress.ts` can override that
module; the hook uses its `create` export too.

Jev receives independent Noul questions, eight chunks per request, at most four
requests concurrently, with an eight-second scoring deadline per displayed text.
Keep `P(useful) >= .2`, including uncertain chunks. This is a conservative
**uncalibrated** threshold. Text under 512 characters and recognizable unified
diffs pass through (a page table or incomplete diff would be worse). A failed
scorer keeps the original with an explicit notice; it does not retry.

Omissions are indexed before retained bodies. Original values are unchanged;
only rendered omitted chunks are copied into the kernel's page table. Hidden
`exec-ingress` session entries record decisions, threshold, query hash, chunk
IDs/labels/sizes/probabilities, and explicit pulls. They add no model tokens.

## Boundary

Raw child stdout/stderr and interrupted-shell captures are bounded diagnostics
in tool-result details, visible in the expanded Pi row but not sent to the model.
Capture a shell result and show it when the model needs it. Exec errors remain
visible as control feedback. This is a context policy, not a security sandbox.
Other extensions' direct notifications and BB tools remain outside this hook;
this change does not claim to intercept those channels.

## Verification — 2026-09-20

A fresh kernel with live Jev kept an exec-cancellation section (p=.95), omitted an
unrelated gardening section (p=.02), and preserved show/console ordering. A later
pull recovered the omitted section without another judgment; raw showed both.
A deferred notification used the same filter. Explicit skill loading stayed
unfiltered. This small smoke example does not establish a miss rate; corpus
measurement remains in `docs/issues/reranker-eval.md`.

The real extension/session-manager drive also verified source rows and edit
anchors, missing-key fail-open, and UI-only stdout/stderr/interrupted-shell
captures. Source-section relevance was .91/.05. Existing suite:
`env -u BB_THREAD_ID bun test` — 196 pass, 2 skip, 0 fail.
