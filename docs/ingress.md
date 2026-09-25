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
as content. Large accepts the same options and raises that call's cap to 32 KiB.

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

For each passage Jev chooses the lowest retention sufficient for the current reading:

- **100% / verbatim:** exact wording or relationships are needed now, particularly before editing or verification.
- **75% / skim75:** understand the substance; telegraphic prose is enough.
- **50% / skim50:** recognize the main ideas; details and some relationships can wait.
- **25% / cues:** peripheral topic cues only, explicitly **not assertions**.
- **0% / omit:** neither detail nor topic cues contribute to this reading.

A persistent local LLMLingua-2 worker token-compresses text at the middle levels.
The percentage is a requested token retention rate, not a byte ratio or a fidelity
guarantee. Skims can lose negations, qualifications and relationships, including at
75%. They are marked incomplete and carry an expansion handle. Pull before relying
on their details. No generated paraphrases are introduced; tokenizer reconstruction
can change spacing. Headings/ancestry remain exact outside the compressed body.

All intermediate retention levels use LLMLingua, including anchored source, code
and tables. Use verbatim when exact syntax or edit anchors matter; compressed
source is not editable evidence. An independent Choice selects the best fallback
excerpt in the same Jev request, used only when compression fails.
Candidates are contiguous source spans grouped from lines/paragraphs, roughly 500
characters each, merged to at most twelve. A low winning probability does not
promote the passage to verbatim: adjacent retention levels commonly share probability.
These choices are not calibrated guarantees of task accuracy.

Jev batches eight passages, up to four requests concurrently, with an eight-second
deadline per displayed text. The local worker serializes compression requests and
allows fifteen seconds per active request, including initial model startup. The seam is
lib/ingress.create({chunk, judge, compress, record}); judge returns mode, distribution,
and fallback excerpt index, while compress accepts {text, rate} jobs and returns
strings. Standalone readers should call dispose(); exec reset kills the kernel
process group, including its local worker.

Adjacent omissions share one notice and one recoverable original. Their ancestry
is preserved without repeating identical lines within the run. Small passages stay
verbatim when the notice or skim would cost more. Full rendering overhead counts
in UTF-8 bytes: successful filtering never makes the text larger. Over budget,
skims yield in descending omission probability; verbatim evidence is not demoted.
The normal byte cap may still truncate, including when exact evidence alone exceeds
it. Text below 512 bytes and recognizable unified diffs pass through. Jev service,
judgment validation or timeout failures keep the original with a warning, without
retry. Missing or failed local compression instead uses labeled exact excerpts and
records a compression-unavailable event. A later read can restart the worker.

## Local setup

Install/cache once from this package directory:

~~~sh
uv run --no-project --python 3.12 --script lib/skim-worker.py --setup
~~~

This machine is prepared. On another machine the command installs the script's pinned
LLMLingua/Transformers dependencies into uv's cache and fetches the approximately
2.2 GB XLM-R-large MeetingBank checkpoint, revision
ebaba9b0e874dadd3003ffcff828e4397e568089. Normal display uses uv's offline mode and
Hugging Face's local-files-only mode; it does not intentionally install/download
models during a read. CPU with four Torch threads is the default. PI_SKIM_DEVICE
can select another supported Torch device; the integrated drive used CPU.

The model is loaded lazily on the first prose skim by a per-user Unix-socket daemon
at `~/.cache/mlegls-pi/skim.sock`, shared across pi sessions. It remains resident
until the daemon exits (e.g. logout or `pkill -f 'skim-worker.py --serve'`).
Startup is elected with a file lock, so simultaneous sessions do not load duplicate
models. The socket and lock live in a private cache directory. Initial cold startup
can exceed fifteen seconds and fall back; subsequent startup in the local drive was
about six seconds, with short warm compressions around 0.3 seconds. The separate
local DNS/connection delay still affects cold Jev requests; integrating LLMLingua
does not fix it. See the [transport investigation](research/caveman/INVESTIGATION.md).

## Replay records and boundaries

Hidden version-3 exec-ingress entries retain the query, focus, full source passages,
ancestry, judgments/distributions, chosen excerpt indices, compressed previews,
actual token/excerpt representation, applied modes, and whether
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

The five-level integration was driven through actual exec show/pull/raw calls: see
[encounter and offline replay](research/ingress-retention-2026-09-22.md).

### Failure-only excerpt fallback (2026-09-23)

Intermediate retention now sends all source types through LLMLingua; the lexical
prose gate is removed. A direct reader drive with fixed skim75 judgments and the
real local compressor confirmed token representations for YAML-frontmatter prose
and anchored code, with no fallback events. The anchored-code display shrank from
1,739 to 1,475 bytes, including labels; its syntax was deliberately incomplete.
Tiny declaration chunks in an earlier probe reverted to verbatim because labels
cost more than compression saved. This checks compressor routing, not live Jev
selection quality or improved task-level economics. Existing compression-failure
and exact-pull replays still pass.

### Names and first reads (2026-09-24)

Bash sessions abandoned the filter after orientation reads came back as keyword cues. The fidelity question now keeps names verbatim when the command asks to see them and treats read-backs as verification; omission notices name what they omit. [Diagnosis and replay](research/ingress-first-reads/README.md).
