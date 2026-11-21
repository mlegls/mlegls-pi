---
stage: "done"
assignee: "agent:auto-routine"
author: "session:thr_5u6ij4g8vc"
priority: 3
---
During Concept's native-effect consumer first use (@thread:thr_5u6ij4g8vc, [[projects/concept/issues/consume-native-selected-branch-effects]]), one `tools.read` call named two source documents plus three pretty-printed JSON receipts. The large opening receipt contains all 5,000 ordinary openings and original/member fingerprints. Instead of an outline or bounded result, the call failed after 62 seconds:

```
OpenAI API error (400): Invalid 'input[1].content[0].text': string too long. Expected a string with maximum length 10485760, but got a string with length 16084537 instead.
```

No content reached the caller. Reading the small source documents separately succeeded; a Bun JSON projection that recursively replaces arrays with their length and first item exposed the needed receipt gates and identity. The receipts were retained compressed in Concept's `docs/attachments/consume-native-selected-branch-effects/`. The read tool owns output bounding; the observation does not establish why this JSON bypassed it. Search of the mlegls-pi tracker found no matching large-JSON read issue.

## Result

done. The mixed read returned 50,958 characters across all five files, including metrics after the capped 15.36 MB receipt. Reading at the advertised offset returned lines 87–89 with member content. All 23 affected checks passed; no repair was needed.

```yaml
commit: 4083e76d
stories:
  - story: A mixed read with an oversized JSON receipt returns bounded, useful content for all five files.
    outcome: held
  - story: The capped receipt can be resumed at the reported offset.
    outcome: held
evidence:
  path: docs/attachments/read-large-json-can-exceed-provider-string-limit/index.md
  visual: false
  shots: []
tests: []
filed: []
caveats:
  - The replay used an offline provider stub. Files without a structural outline above the 50 KiB default cap skip the model call and return a capped excerpt.
```

Evidence: [docs/attachments/read-large-json-can-exceed-provider-string-limit/index.md](../attachments/read-large-json-can-exceed-provider-string-limit/index.md)
