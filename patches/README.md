# Jevgrep structured output

`@dzhng%2Fjevgrep@0.4.2.patch` adds `jg --json` to the published CLI bundle.
Bun applies it during install; no postinstall script or separate fork is needed.

Schema v1 returns an absolute search `root`, ranked `files` containing paths and
budgeted excerpts, plus `introduction` and `closing` presentation text. Excerpts
retain the upstream line ranges, source bytes, and partial-byte metadata. Normal
text output, retrieval, source allocation, and exit statuses are unchanged.

`ab/jevgrep.ts` verifies whole-line excerpts against a current source snapshot and
renders them through the shared session ledger. Jevgrep never allocates anchors.
`ab/jevgrep.test.ts` covers the patched renderer and ledger integration. Revisit
this patch when updating the dependency; replace it with upstream structured
output if available.
