---
stage: done
assignee: agent
author: session:cb714bb4-5239-4dd1-b675-73ab6f00dcfe
---
Done: `read({path: '"dir/a b.md"'})` reads `dir/a b.md`, through codemode and directly; an unquoted literal path containing spaces that exists still wins over splitting. A test in `lib/outline-read` covers both.

Cause (2026-10-14 triage): the read tool is this repo's `lib/outline-read/read.ts` (registered by `extensions/fragment`), not pi's. `execute` computes `specs = words(params.path)` but when there is one spec it reads `[params.path]`, the raw string with its quotes. Use `specs` when `words` yields one spec; keep the raw string only for the existing-literal-path case. Reproduced 2026-10-14 with `/tmp/sp test/a b.md`.

The codemode `read` tool advertises quoted paths for names containing spaces, but treated the quotes as part of the filesystem name during Concept's review-card scale probe (2026-10-10).

`tools.read({path: '"docs/core/concepts/Personal scope.md"'})` returned `ENOENT .../"docs/core/concepts/Personal scope.md"`. The earlier backslash-escaped form was split at the space and looked for `docs/core/concepts/Personal\`. The file exists; `tools.grep({pattern: ".", path: "docs/core/concepts", glob: "Personal scope.md"})` read its complete seven-line content and was the workaround. No read-bridge implementation was inspected. Owner: pi's codemode file-read argument handling or its advertised contract.

Drive observation (2026-10-14): supplied runner passes (1 test, 2 expectations) on f90bdd0797b28b1be2fd561201c501bcd29f04c1. This session's live codemode read still rejects a quoted driver-owned space-containing path with ENOENT including literal quotes; the unquoted equivalent succeeds. This may be a loaded-extension/reload discrepancy, not established as a failure of the committed library. Evidence: [drive packet](../attachments/codemode-read-does-not-honor-quoted-space-containing-paths/index.md). Direct standalone tool use remains unobserved. Reviewer must establish fresh runtime behavior before acceptance.

## Result

done — the fix in `lib/outline-read/read.ts` is correct. The driver's live failure came from the session loading the canonical checkout, which doesn't have the fix until this branch is merged.

- **Why the live read failed:** `~/.pi/agent/settings.json` loads the package from `../../dev/mlegls-pi`, and `lib/outline-read/read.ts:87` there still has the old `specs.length === 1 || …` line. I reproduced the same ENOENT with literal quotes from this session on `/tmp/sp test/a b.md`. The unquoted form succeeded.
- **Runtime check:** `bun test lib/outline-read/read.test.ts` passes (1 test, 2 expectations). It calls `execute` on the real `registerReadTool` (the same registration `extensions/fragment` and `extensions/hashline` use) with the quoted and unquoted paths. Both return `dir/a b.md (1 lines)` plus the content, even though both split paths (`dir/a` and `b.md`) also exist.
- **Diff review:** the literal path is now used only when `words` yields more than one spec and that literal file exists. A single quoted or plain spec is read from `specs`, and offset/limit apply as before. I found no defects.
- **Not re-driven live:** the codemode and direct paths both end in `execute` on the same registered tool, so the test covers both. Re-driving live needs a reload after the branch lands.
- **No new tracker issues.** I appended the review to the packet and committed it as `ef6508b3`.

```yaml
commit: ef6508b3
stories:
  - story: Quoted path through codemode
    outcome: held
  - story: Existing unquoted literal path wins
    outcome: held
  - story: Quoted path directly
    outcome: held
evidence:
  path: docs/attachments/codemode-read-does-not-honor-quoted-space-containing-paths/index.md
  visual: false
  shots: []
tests:
  - lib/outline-read/read.test.ts
caveats:
  - Live codemode in sessions loading the canonical checkout shows the fix only after this branch is merged and the extension reloads.
```

Evidence: [docs/attachments/codemode-read-does-not-honor-quoted-space-containing-paths/index.md](docs/attachments/codemode-read-does-not-honor-quoted-space-containing-paths/index.md)
