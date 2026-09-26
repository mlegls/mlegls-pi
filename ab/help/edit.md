ab edit [PATH] < hunks

PATH, when given, asserts the file every hunk targets (same as @PATH on each header).

Hunks come from stdin (use a quoted heredoc, so nothing in the body is interpreted):

  ab edit <<'EOF'
  =abcd
  replacement line

  =abcd wxyz @src/file.ts
  replaces the inclusive range abcd..wxyz, asserting its file

  -abcd

  >wxyz
  inserted after wxyz

  <wxyz
  inserted before wxyz
  EOF

`=a` replaces a line, `=a b` an inclusive range, `-a` / `-a b` delete, `>a` inserts
after, `<a` before. a/b are four-character anchors from ab read/grep, not line
numbers. Separate hunks with a blank line. A body line that looks like a header must
be escaped with a backslash immediately before its sigil, after indentation:

    \<time
      dateTime={value}
    >

This writes `<time` with its indentation preserved. Double the backslash to retain it. Empty >/<
bodies insert one blank line; empty replacement bodies still need an explicit -a.
Bodies are new text, not unified diffs: no + additions, - removals, or old/context lines.
`=a` replaces only one old line even with a multiline body. To replace a block, use
`=a b` with its first and last anchors. Text outside that range stays untouched.
Diff-looking bodies are warned about, never silently stripped or expanded.

Changed lines reject stale anchors; re-read and retry. Multi-file edits are not
transactions: a failure names files already changed.
New files: cat > path <<'EOF'. Computed rewrites: sd, perl -pi, or a bun script.
