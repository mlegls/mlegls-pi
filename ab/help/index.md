ab — anchored file tools and library adapters for shell-driven agents

  ab read PATH[:SEL]...     anchored lines; outline for long files
  ab grep PATTERN [PATH]... anchored matches, directly editable
  ab edit < hunks           replace/insert/delete lines by anchor
  ab raw [CMD ARG...]       exact output past the bash tool's filter (or CMD | ab raw)
  ab view IMAGE...          attach images to the tool result
  ab skill PATH             load a SKILL.md with its dynamic shell blocks expanded
  ab code VERB [NAME]       TypeScript definitions and checker-resolved references
  ab computer "INTENT"      Jev-driven browser (--url/--browser) or explicit native window
  ab pull ING-ID            original text behind a skimmed/omitted output page
  ab lib MODULE [FN] [ARG]  call a lib/ export; ARGs parse as JSON when they can
  ab daemon [status|stop ID|shutdown] manage the per-user job daemon
  ab job start TYPE JSON  start a restartable job
  ab supervise start TICKET  run a subtree's implement → verify → integrate loop, waking this agent on exceptions
  ab mail MAILBOX TEXT       message a pi session (its mail/xxxxxxxx topic, shown in its footer and tmux status)

ab CMD --help for each. Plain shell covers the rest: fd, rg, cat > f <<'EOF', sed, jq, git.
The same code is importable from bun/node/zx: lib/*.ts, extensions/exec/source.ts.
Anchors persist per session in $AB_SESSION_STATE or $AB_STATE (default ~/.local/state/ab/<cwd hash>).
The per-user daemon socket and job records live under $AB_STATE (default ~/.local/state/ab).
