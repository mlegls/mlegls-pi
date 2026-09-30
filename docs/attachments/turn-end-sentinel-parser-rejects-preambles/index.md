# Turn-end sentinel parser: first-use drive

## Predictions before opening the product

From the ticket and [worker turn-end report](../../issues/worker-turn-end-report.md), I expect the report parser to return `done` for each finished-worker shape below without a resend:

1. **First-word sentinel:** `done` at the start of the message, followed by prose or a fenced handoff, is accepted.
2. **Fenced handoff first (calm-composition):** a fenced `yaml` block containing `status: done`, even with no sentinel preceding it, is accepted.
3. **Prose first (offer-applets / teach-chess / emit-feature-use):** prose followed by a standalone `done` line is accepted; a mere `done` inside ordinary prose should not be mistaken for a standalone line.
4. **Malformed handoff (frame-the-author-page):** prose and an unquoted `: "patch:title"` in the block will not erase a valid standalone `done`; I expect either a parse-shape error for the block or a partial handoff, not a no-status error.
5. **Two paragraphs, middle sentinel, handoff (pin-this-edition-lasts-one-document):** `done` on its own line between prose and a handoff with `status: done` is accepted.
6. **Trailing sentinel (server-render-the-signed-in-pages):** prose, then handoff, then `done` on the final line is accepted.
7. **Handoff-only status:** a fenced block with `status: done` anywhere and no lone sentinel is accepted.
8. **Conflicts and missing status:** distinct statuses in the message are rejected as a shape error rather than guessed; a message with neither sentinel nor handoff status is reported missing.

I expect the changed surface to be a local library/CLI, not a rendered UI. I will identify its public entry point via documentation or export listing, then call it from the checkout. These are predictions, not observations.

## Setup and surface

- Revision: `db6335b` (`turn-end-sentinel-parser-rejects-preambles-drive`, checkout-owned). Implementer handoff was `null`; no deployment selector, credentials or seed were supplied. The task is a local TypeScript library, not a network deployment; persona is a coordinator consuming a worker's final message. No auth or data mutation is needed.
- Committed local setup: root `node_modules` was present, `bun` was available, and `ab lib report` listed `parse(1)`. The first invocation, `ab lib report parse 'done'`, returned `{"status":"done","handoff":null,"handoffError":null,"body":"done"}`. That was the observed readiness of the checkout-owned library; no server or external target was started.
- Reproduction entry point: from this checkout, `bun -e 'import { parse } from "./lib/report.ts"; console.log(parse("done"))'`. Drive used the exported `parse(text)` via Bun, with messages matching the shapes in the ticket. No implementation, tests, diffs or fixtures were read. `visual: false` (library-only journey).

## Drive log

All messages were sent through `parse(text)` as the coordinator would consume a worker's final text. The table gives JavaScript single-quoted string contents: `\n` denotes a newline and `\x60` a backtick. For each call I recorded the public `status`, `handoff`, and `handoffError` fields (omitting `body`, which echoed input). All calls returned without throwing.

| Story / action: pass this text to `parse` | Observed result | Outcome |
| --- | --- | --- |
| First word: `done\n\nCommitted.\n\n\x60\x60\x60yaml\ncommit: abc123\n\x60\x60\x60` | `status: done`; handoff `{commit: abc123}`; error null | held |
| Fenced handoff first: `\x60\x60\x60yaml\nstatus: done\ncommit: abc123\n\x60\x60\x60` | `status: done`; handoff includes both fields; error null | held |
| Prose first, then standalone sentinel: `Committed as abc123.\n\ndone` | `status: done`; handoff null; error null | held |
| Ordinary prose: `Committed and done with this.` | `status: null`; handoff null; error null | held (negative control) |
| Malformed handoff: `Committed.\n\ndone\n\n\x60\x60\x60yaml\n: "patch:title"\n\x60\x60\x60` | `status: done`; handoff null; error null | held for status; see friction |
| Two paragraphs, middle sentinel: `Finished the work.\n\nEverything is committed.\n\ndone\n\n\x60\x60\x60yaml\nstatus: done\ncommit: abc123\n\x60\x60\x60` | `status: done`; handoff includes both fields; error null | held |
| Trailing sentinel: `Finished.\n\n\x60\x60\x60yaml\ncommit: abc123\n\x60\x60\x60\n\ndone` | `status: done`; handoff `{commit: abc123}`; error null | held |
| Handoff only, after prose: `Summary.\n\n\x60\x60\x60yaml\nstatus: done\ncommit: abc123\n\x60\x60\x60` | `status: done`; handoff includes both fields; error null | held |
| Conflict: `done\n\n\x60\x60\x60yaml\nstatus: blocked\nquestion: What next?\n\x60\x60\x60` | `status: null`; handoff `{status: blocked, question: "What next?"}`; `handoffError: "conflicting report statuses: done, blocked"` | held |
| Missing status: `Committed as abc123.\n\n\x60\x60\x60yaml\ncommit: abc123\n\x60\x60\x60` | `status: null`; handoff `{commit: abc123}`; error null | held (negative control) |

## Expectations after use

- Met: a status at the first word, standalone after prose, between prose and handoff, or at the very end was returned as `done`. The handoff's `status: done` alone also supplied the status.
- Met: a conflicting `blocked` handoff did not win or silently override `done`; `status` was null and `handoffError` explained the conflict.
- Met: `done` inside ordinary prose did not become a status; missing status stayed null.
- Partly not met: I expected the malformed handoff to surface a parse-shape error or partially decode. Instead the block vanished (`handoff: null`, `handoffError: null`), although the standalone `done` survived. The ticket's status claim still held; whether malformed-block diagnostics should be surfaced belongs to the handoff-shape-errors scope, not this drive.

## Frictions

- No setup handoff was supplied. I had to find the entry point by reading the user-facing report contract and listing `ab lib report` exports. The library worked once found, but this cost an exploratory call.
- An invalid YAML block disappears without a handoff error, so a caller cannot distinguish malformed handoff from no handoff via `handoff`/`handoffError`; the sentinel still works. This made the frame-the-author-page shape less clear than expected.

## Replayable checks for the reviewer

1. Feed the first-word, fenced-first, prose-then-sentinel, malformed-handoff, middle-sentinel, trailing-sentinel and handoff-only strings in the table to the public `parse(text)` entry point; accept `status === "done"`. For the fenced valid blocks also accept the listed handoff fields and `handoffError === null`. For the malformed block accept `status === "done"`; separately decide whether invalid YAML should be diagnosable under the handoff-shape ticket.
2. Feed the ordinary-prose string; accept `status === null`. Feed the no-status string; accept `status === null` and parsed commit, so there is no guessed completion.
3. Feed the conflict string; accept `status === null` and a non-null error identifying both `done` and `blocked` (rather than picking one). This is the observable bounce signal, not proof that the orchestration loop actually sends mail.
4. Feed `Finished.\n\n\x60\x60\x60yaml\ncommit: abc123\n\x60\x60\x60\n\ndone`; accept `status === "done"` even though the sentinel is the last line. A first-line-only parser would fail this control.

No rendered state, screenshots, persistent data or external resources were involved.
