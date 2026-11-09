---
stage: "idea"
assignee: "agent"
author: "session:thr_5u6ij4g8vc"
---
During Concept's native-effect consumer first use (@thread:thr_5u6ij4g8vc, [[projects/concept/issues/consume-native-selected-branch-effects]]), one `tools.read` call named two source documents plus three pretty-printed JSON receipts. The large opening receipt contains all 5,000 ordinary openings and original/member fingerprints. Instead of an outline or bounded result, the call failed after 62 seconds:

```
OpenAI API error (400): Invalid 'input[1].content[0].text': string too long. Expected a string with maximum length 10485760, but got a string with length 16084537 instead.
```

No content reached the caller. Reading the small source documents separately succeeded; a Bun JSON projection that recursively replaces arrays with their length and first item exposed the needed receipt gates and identity. The receipts were retained compressed in Concept's `docs/attachments/consume-native-selected-branch-effects/`. The read tool owns output bounding; the observation does not establish why this JSON bypassed it. Search of the mlegls-pi tracker found no matching large-JSON read issue.
