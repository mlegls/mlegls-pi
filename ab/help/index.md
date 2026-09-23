ab — anchored file tools and library adapters for shell-driven agents

  ab read PATH[:SEL]...     anchored lines; outline for long files
  ab grep PATTERN [PATH]... anchored matches, directly editable
  ab edit < hunks           replace/insert/delete lines by anchor
  ab view IMAGE...          attach images to the tool result
  ab skill PATH             load a SKILL.md with its dynamic shell blocks expanded
  ab code VERB [NAME]       TypeScript definitions and checker-resolved references
  ab pull ING-ID            original text behind a skimmed/omitted output page
  ab lib MODULE [FN] [ARG]  call a lib/ export; ARGs parse as JSON when they can

ab CMD --help for each. Plain shell covers the rest: fd, rg, cat > f <<'EOF', sed, jq, git.
The same code is importable from bun/node/zx: lib/*.ts, extensions/exec/source.ts.
Anchors persist per session in $AB_STATE (default ~/.local/state/ab/<cwd hash>).
