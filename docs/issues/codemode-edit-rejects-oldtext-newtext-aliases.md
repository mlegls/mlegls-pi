---
stage: "done"
assignee: "agent"
priority: 3
author: "session:thr_ivvhpy2bsb"
---
# Edit through codemode still rejects oldText/newText

[[tool-argument-papercuts-cost-a-turn-each]] made `edit` accept `oldText`/`newText` as aliases of `old`/`new`, with tests through `prepareArguments` (@thread:thr_dfgkcug6jp#msg=2513). After it landed, the AP authoring thread still got `edits.0.new: missing` from `tools.edit` in codemode with `oldText`/`newText` in the payload (@thread:thr_5az79m87jp#msg=721). Found by the 2026-11-19 efficiency audit (@thread:thr_ivvhpy2bsb): 2 unique failures in 11-16→11-19, against 44 before the fix, so the codemode path is the remaining leak.

## tasks

1. Find the boundary that validates `edits` before alias normalization when edit is called through codemode's tool dispatch, and normalize before that validation.
2. Done when: an acceptance test calls edit through the codemode dispatch with `oldText`/`newText` and the edit applies.

## Result

done. `oldText`/`newText` already worked through codemode on the base. The reported failure used `old_string`/`new_string`; both spellings now apply the edit. An omitted replacement fails validation and leaves the file unchanged. All three affected tests passed.

```yaml
commit: 9852240d
stories:
  - story: Codemode edit applies a replacement using oldText and newText
    outcome: held
  - story: Codemode edit accepts old_string and new_string, and canonical fields take precedence
    outcome: held
evidence:
  path: docs/attachments/codemode-edit-rejects-oldtext-newtext-aliases/index.md
  visual: false
  shots: []
tests:
  - lib/outline-read/fragment.test.ts
filed: []
caveats:
  - The acceptance test starts five local pi sessions to exercise real dispatch; together they took 349 ms with no network or model calls.
```

Evidence: [docs/attachments/codemode-edit-rejects-oldtext-newtext-aliases/index.md](../attachments/codemode-edit-rejects-oldtext-newtext-aliases/index.md)
