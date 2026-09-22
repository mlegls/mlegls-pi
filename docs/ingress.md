# Exec ingress

External information should reach the session at the fidelity its reading needs:
exact evidence at the focus, a source sketch in the periphery, and recoverable
omissions elsewhere. Exec applies this at display time, not read time.

## Use

Reload the extension (/reload or restart Pi) to update the advertised API. A kernel
reset loads the new runtime and library. Jev uses the existing JEV_API_KEY or
Cloudflare credentials supported by lib/decide.ts.

~~~ts
await show(await read("lib/ingress.ts"), { focus: "understand the architecture" });
await show(await read("lib/ingress.ts"), { focus: "inspect budget handling before editing" });
await show(state.source);       // implicit reading intent
await show.pull("ing-…");       // exact original of a skim or omitted run
await show.raw(state.source);   // no semantic transformation
~~~

Focus supplements implicit context rather than replacing it. It describes the
operation as well as the subject: orientation and editing need different fidelity.
A trailing object whose only key is a string-valued focus is options when another
value precedes it; other variadic values remain content. Raw treats all arguments
as content. Large accepts the same options and raises the cell cap to 50 KiB.

Console aliases and notification results use implicit focus. Loaded skills, API
help and images bypass the filter. Raw and pull still obey normal byte/image caps.
Source values stay unchanged; recovery IDs are not edit anchors. Originals expire
on kernel reset, interruption or session navigation.

## Reading policy

Implicit context is up to six recent user/assistant text messages from the active,
compaction-applied branch (12,000 characters), plus up to 4,000 characters of the
current cell. Thinking and previous tool-result bodies are excluded. Notifications
use the latest cell's context. No context and no explicit focus means no filtering.

The lossless chunker groups Markdown headings with bodies, tracks heading ancestry,
and binds trailing comments to declarations. Source identities and declaration
signatures carry into continuation chunks. Rendered sibling records remain separate.
Passages are bounded to 4,096 characters, splitting at lines or, for long lines, code
points. This is lexical structure, not an AST or a specialized log parser.

For each passage Jev chooses:

- **Verbatim:** exact detail is needed for action, interpretation, editing or verification.
- **Skim:** ancestry plus one source excerpt is sufficient for peripheral understanding.
- **Omit:** neither detail nor gist contributes to the reading.

An independent speculative Choice selects the best skim excerpt in the same request.
Candidates are contiguous, lossless source spans grouped from lines/paragraphs,
roughly 500 characters each, merged to at most twelve candidates. Jev selects;
code copies. Skims are explicitly marked incomplete and carry a recovery handle.
They are not generated summaries. If fidelity's winning probability is below .6,
the passage stays verbatim. This conservative policy is not calibrated accuracy.

Batches contain eight passages, with up to four requests concurrently and an
eight-second deadline per displayed text. The importing seam is
lib/ingress.create({chunk, judge, record}); judge returns mode, distribution, and
excerpt index. It replaces the prototype's score/threshold seam.

Adjacent omissions share one notice and one recoverable original. Their ancestry
is preserved without repeating identical lines within the run. Small passages stay
verbatim when the notice or skim would cost more. Full rendering overhead counts
in UTF-8 bytes: successful filtering never makes the text larger. Over budget,
skims yield in descending omission probability; verbatim evidence is not demoted.
The normal byte cap may still truncate, including when exact evidence alone exceeds
it. Text below 512 bytes and recognizable unified diffs pass through. Service,
validation or timeout failures keep the original with a warning, without retry.

## Replay records and boundaries

Hidden version-2 exec-ingress entries retain the query, focus, full source passages,
ancestry, judgments/distributions, chosen excerpt indices, applied modes, and whether
attention, budget or rendering overhead determined them. They also record latency
and input/output bytes. Pulls and failures are separate events. These inputs allow
local replay, unlike the prototype's query hash and labels alone.

These records add no model tokens, but increase session storage and retain external
text even when it was not displayed. They use the session's existing local storage
and retention; do not treat omitted material as absent from the session log.
The version identifies the current candidate/policy implementation; historical
replays should use its corresponding source revision.

Raw child stdout/stderr and interrupted-shell captures remain bounded UI-only
diagnostics. Other extensions' direct notifications remain outside this hook.
This is an attention policy, not a security sandbox.

## Verification

The 2026-09-22 live exec drive read the same anchored source twice. Architecture
focus produced a 5,278-byte extractive sketch from 15,971 bytes; inspection before
editing retained all 15,971 bytes. Exact expansion, raw, and variadic compatibility
were exercised. A cross-VM options bug was found and fixed during this drive.

[Encounter, replay and limits](research/ingress-foveation-2026-09-22.md).
This establishes the focused-reading surface and one useful fidelity distinction,
not a miss rate or general semantic accuracy. The earlier binary filter's smoke
examples are superseded by this reading policy.
