---
stage: done
assignee: agent
author: "session:01a0e82e-355d-76ee-884c-e3e6e0f99a82"
---

[[projects/mlegls-pi/issues/worker-turn-end-report]] says the parser finds the sentinel tolerantly, including after a preamble or fences, but `firstStatus` in `lib/report.ts` accepts it only on the first nonblank line, or the second after a short heading. In the 2026-09-26 concept campaign, four finished children came back as "no status sentinel" and each needed a mail asking it to re-emit with no changes:
- calm-composition opened with a fenced `yaml` block;
- offer-applets opened with prose;
- frame-the-author-page opened wrongly and also had an unquoted `: "patch:title"` in its handoff;
- pin-this-edition-lasts-one-document had two prose paragraphs, then `done` on its own line, then a handoff block with `status: done`.

Either the prompt pieces should make "sentinel first" unmissable, or the parser should accept a lone sentinel line or a handoff block's `status:` field anywhere in the final message, as the spec says.

2026-09-26: a fifth shape, from server-render-the-signed-in-pages: prose, then the handoff block, then `done` as the last line. A trailing sentinel fails the same way.

2026-09-29: the prompt pieces point at the end. `agents/roles/implement.md` says "End with the status sentinel and a fenced yaml handoff", `agents/_common.md` says "End your turn with the first word `done`", and `docs/dispatch.md` says "the last message starts with `done`". Read quickly, each puts the sentinel last; the coordinating session misread them the same way and steered three workers to put `done` last, which the parser rejected again. In the concept campaign, teach-chess-with-an-inspectable-commandable-applet opened with a summary twice, the second time after an explicit "bare `done` as the very first line" mail, and emit-feature-use-from-map-and-hub-operations opened with "Committed as …". Both branches were clean and were sent to `verify` instead of a third re-emit.
triage, 2026-09-30: the contract is already decided (tolerant, per [[projects/mlegls-pi/issues/worker-turn-end-report]]); the code is behind it. `lib/report.ts` accepts the sentinel as the first word, as a line of its own anywhere in the final message (first, last, or between prose and the handoff), or as the handoff's `status:`; conflicting statuses are an error the loop bounces per [[projects/mlegls-pi/issues/bounce-handoff-shape-errors-to-the-child]]. Prompts keep asking for first-word. done: the five recorded shapes above parse, as `lib/report.ts` tests.

review boundary, 2026-09-30: the supervise-loop group (bounce-handoff-shape-errors-to-the-child, address-the-waiting-child-in-exception-mail, supervise-job-dies-on-a-decision-api-503-at-child-launch, surface-stale-waits-after-owner-replies, turn-end-sentinel-parser-rejects-preambles) is reviewed once as a combined delta from `894e8c6` by the root tend session after all five integrate, before the next `ab daemon shutdown` loads them. Leaves integrate without per-leaf review.

Result: [First-use drive packet](../attachments/turn-end-sentinel-parser-rejects-preambles/index.md).

## Verification evidence

[Encounter and evidence](../attachments/turn-end-sentinel-parser-rejects-preambles/index.md).

combined code review, 2026-09-30 (root tend session, `894e8c6..275ae59`, lib/jobs/supervise.ts, lib/report.ts, lib/decide.ts, lib/board/subscribers.ts, lib/board/scopes.ts): accepted with one repair. `repairReport` sent the drive/review stories+evidence schema to every phase, so an implementer bounced for a missing sentinel or bad YAML was told to replace its `commit`/`setup` handoff with `stories`/`evidence`; non-drive/review/consolidate phases now get a sentinel-plus-own-role-handoff instruction. Residuals, left as is: a status conflict from `lib/report.ts` travels as `handoffError`, so its bounce is labeled "handoff YAML parse error"; any line that is only a status word counts as a sentinel candidate, so a lone `blocked` line in prose turns a `done` report into a conflict bounce. Focused suites (lib/jobs, lib/report, lib/decision-outage, lib/board) pass.
