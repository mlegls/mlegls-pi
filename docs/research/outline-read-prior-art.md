# Outline-first `read` tools: prior art

Checked 2026-09-09. Motivation: replace pi's built-in `read` with one that
returns an outline by default and requires explicit range reads for bodies,
with an LLM-generated outline for file types without a parser.

## Conclusion

The tree-sitter half is solved and available for pi today. The novel parts
are (a) outline-by-default for every file type, with a small-model fallback
where no parser exists, and (b) combining the outline with hash-anchored
editing. No existing extension does both; `oh-my-pi` does the second natively
and is the format reference.

The local extension is written from scratch, copying from the sources below,
because the reusable parts of `pi-codebase-reader` are its parser layer, the
policy layer is what changes, and the rest of that package (explorer
subagent, SHERLOC tools, slash commands) is unrelated.

## Direct precedents

| Source | What it does | Taken |
| --- | --- | --- |
| [Sweep, "A better way for coding agents to read files"](https://blog.sweep.dev/posts/read-file) (2026-01) | Wraps `read_file` instead of adding a separate outline tool, because models trained to call `read` directly do not "peek first" even when prompted. Adaptive depth: shrink outline depth until under a token budget; `(N children)` markers signal hidden structure. | Override `read`; adaptive depth. |
| [oh-my-pi `read-summary.ts`](https://github.com/can1357/oh-my-pi) | `read` on parseable code with no selector returns declarations with bodies collapsed to `..`/`…`; footer `[NN lines elided; re-read needed ranges, e.g. :5-16,40-80]`; multi-range selector `path:5-16,120-200`; kept lines carry hashline anchors and are recorded as served. Parser is native (`@oh-my-pi/pi-natives`). | Output format, selector grammar, anchors on kept lines. |
| [pi-codebase-reader](https://github.com/HanzCEO/pi-codebase-reader) 0.7.1 | pi extension overriding `read`: <200 lines full, else tree-sitter outline with 3-line previews and line ranges, `ranges: [{offset,limit}]` drill-down. web-tree-sitter WASM, hand-written extractors for 10 languages, regex markdown headings (matches `#` inside fenced code). When `pi-hashline-edit-pro` is installed it registers nothing. | WASM loading; markdown heading nesting; 200-line threshold. |
| [pi-hashline-edit-pro](https://github.com/YuGiMob/pi-hashline-edit-pro) | 4-char tokenizer-friendly anchors, allocation-based identity with a session registry and sidecar files; stale or unowned anchors are rejected and the current range is returned with fresh anchors so the retry needs no re-read; pasted `anchor│` prefixes stripped. | Anchor shape and edit error semantics. Not the allocation registry: content hashes are stateless. |
| Claude Code hook interceptors ([readzip](https://github.com/rishiskhare/readzip), ast-bro `hook`, Continuous-Claude `tldr-read-enforcer`; [claude-code#34304](https://github.com/anthropics/claude-code/issues/34304)) | PreToolUse hooks substitute an AST map for large `Read` calls; pass through when `offset`/`limit` is set. | Confirms the pass-through rule for ranged reads. |

## Separate-tool approaches (not taken)

`ast-outline`, `codetree`, `coderay`, `skeletree`, `swift-skeleton` expose
outline/skeleton/show commands as CLI or MCP tools and rely on AGENTS.md
prompting. Sweep and the readzip author both report models ignore these.
Roo Code's `read_file` has an `indentation` mode anchored on a line, which is
block extraction rather than an outline.

## Repo-level maps (complementary)

aider's repo map (tree-sitter `tags.scm` + personalized PageRank, token
budgeted, injected every turn), `reducethemtokens`, `skeletree.md`. These
answer "which file" rather than "which part of this file". aider's use of the
grammar-shipped `tags.scm` queries is the basis for the generic extractor here.

## LLM-generated outlines

No read tool found uses a model to outline unsupported file types; fallbacks
are first/last N lines or header only. Related: `red-dragon` lowers
unsupported languages to IR with an LLM behind deterministic frontends;
OpenHuman/TokenJuice compresses tool results and keeps originals behind a
retrieve token; Shi et al. 2024 "NL Outlines" is the academic reference.

## Decisions

1. Generic tree-sitter extractor driven by each grammar's `tags.scm`, with
   language special cases only when needed.
2. Outline by default above a configurable line threshold (200).
3. Fallback outline from `pi -p` with no extensions (default
   `openai-codex/gpt-5.6-luna`, medium thinking; configurable or disabled),
   cached by content hash.
4. Outline sources implement one interface returning
   `{name, kind, startLine, endLine, children}` so LSP `documentSymbol` or
   others can be added.
5. Anchors: 4 chars, unambiguous lowercase alphanumerics, content hash with
   in-file collision bumping; per-file ledger persisted as pi session entries
   (branch-aware, survives resume); own `edit` tool. omp's `[path#TAG]` +
   line numbers was rejected because any edit invalidates every reference.
