ab edit [FILE|-]  < hunks

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
be escaped with a leading \ (double it to keep a literal backslash). Empty >/<
bodies insert one blank line; empty replacement bodies still need an explicit -a.
Range replacement is literal: don't repeat text outside the range.

Changed lines reject stale anchors; re-read and retry. Multi-file edits are not
transactions: a failure names files already changed.
New files: cat > path <<'EOF'. Computed rewrites: sd, perl -pi, or a bun script.
