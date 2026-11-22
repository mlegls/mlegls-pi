---
stage: "ticket"
assignee: "agent"
priority: 3
author: "session:thr_vrgtjptnu2"
---
# Edit's schema error should name the accepted fields

[[codemode-edit-rejects-oldtext-newtext-aliases]] added `old_string`/`new_string`. In 11-19→11-23 there were still 6 `edits.0.new: missing` failures in 5 sessions, now from `old_text`/`new_text` and `replace`/`from` (e.g. @thread:thr_waxm5hhybt, 11-19 11:59). Each costs a turn. Adding aliases one at a time chases the tail; the error can teach the shape instead. Found by the 2026-11-23 efficiency audit (@thread:thr_vrgtjptnu2, Opus auditor @thread:thr_ujfhuerecr).

## tasks

1. When an `edits` item lacks `old`/`new`, the error names its keys and the accepted ones: "edits.0 has {old_text, new_text}; use {old, new} (or oldText/newText, old_string/new_string)". Accept `old_text`/`new_text` too, since snake_case of the existing camel alias is the same spelling family.
2. Done when: a codemode-dispatch test with `replace`/`from` gets that message and leaves the file unchanged.
