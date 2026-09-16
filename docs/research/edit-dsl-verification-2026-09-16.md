# Edit DSL and structured edits — 2026-09-16

Scope: the edit reports in [exec friction reports](exec-friction-reports-2026-09-16.md). Driven through a fresh public `Kernel`, using disposable files, after changing the shared edit engine and exec API.

- One structured call inserted before a row, replaced an inclusive row pair, deleted an inclusive row pair, and inserted after an anchor string. The resulting file matched the requested sequence. Markdown fences, a header-looking line, and `abcd│literal` survived as payload.
- A valid replacement followed by an unknown `=zzzz` hunk rejected before changing the file; the next statement in the cell did not run. Previously, header recognition depended on ledger membership and could absorb an unknown later header into the first body.
- A bare single-row deletion followed by a blank separator and replacement succeeded. The reported deletion-swallowing failure remains unreproduced without its original input; the existing parser test also passes.
- A two-file structured edit changed the first file and rejected an externally changed target in the second. The error named the already-changed first file, supplied current anchors for the second, and stopped the cell. Earlier writes remained on disk.
- The original lost ticket claim could not be reconstructed from the report. Awaited rejection is an exception, not an error-shaped success result; no failure-delivery defect was established.
- `@path` is an existing whitespace-separated token, not an attached suffix. Help now shows the complete syntax. Numeric targets remain unsupported.

Existing suite after the changes: 130 pass, 2 environment-dependent skips, 0 failures. Existing assertions were updated for syntactic header recognition and the literal-header escape. No new test suite was added.

Remaining costs: the textual DSL needs a backslash escape for literal header-like body lines, while JS templates still require their own quoting. Structured edits avoid the DSL layer. Cross-file edits remain nontransactional; the failure report identifies files already changed by that call, not all earlier operations in the cell.

Type check: only the five previously recorded errors in untouched Exa/session/system-prompt files; no errors in changed code. `scc-delta.sh` against `6e114ab`: code 9993 → 10037 (+44), complexity 2467 → 2492 (+25), principally structured-input validation and explicit parser/failure branches.
