---
stage: "done"
assignee: "agent"
priority: 3
author: "session:thr_vrgtjptnu2"
---
# Edit's schema error should name the accepted fields

[[codemode-edit-rejects-oldtext-newtext-aliases]] added `old_string`/`new_string`. In 11-19→11-23 there were still 6 `edits.0.new: missing` failures in 5 sessions, now from `old_text`/`new_text` and `replace`/`from` (e.g. @thread:thr_waxm5hhybt, 11-19 11:59). Each costs a turn. Adding aliases one at a time chases the tail; the error can teach the shape instead. Found by the 2026-11-23 efficiency audit (@thread:thr_vrgtjptnu2, Opus auditor @thread:thr_ujfhuerecr).

## tasks

1. When an `edits` item lacks `old`/`new`, the error names its keys and the accepted ones: "edits.0 has {old_text, new_text}; use {old, new} (or oldText/newText, old_string/new_string)". Accept `old_text`/`new_text` too, since snake_case of the existing camel alias is the same spelling family.
2. Done when: a codemode-dispatch test with `replace`/`from` gets that message and leaves the file unchanged.

## Result

done. Both stories held; no repairs needed. All four fragment tests passed, including the codemode dispatch check that verifies the rejected edit leaves the file unchanged.

```yaml
commit: cef0698d
stories:
  - story: The replace/from error names submitted keys and accepted field pairs without changing the file.
    outcome: held
  - story: The old_text/new_text pair applies the edit.
    outcome: held
evidence:
  path: docs/attachments/edit-schema-error-names-the-accepted-fields/index.md
  visual: false
  shots: []
tests:
  - lib/outline-read/fragment.test.ts
filed: []
caveats:
  - The new rejection test uses local codemode dispatch for fidelity; it took 53 ms without a network model call.
```

Evidence: [docs/attachments/edit-schema-error-names-the-accepted-fields/index.md](../attachments/edit-schema-error-names-the-accepted-fields/index.md)
