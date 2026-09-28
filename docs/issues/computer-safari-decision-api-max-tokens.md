---
stage: idea
author: session:01a0e6e8-77cb-7796-a17b-1733f8c6d4f0
---

During the final Safari pass of [[projects/concept/issues/check-zh-cn-font-stacks-in-safari]], `ab computer --app Safari` was used on the authenticated local Application Session in Safari 26.0.1. The first call ran for 930 seconds and ended with `Decision API: HTTP 400 max_tokens_exceeded` after zero actions. Scoped retries abstained at step 0. Trace JSONL files in the originating session's `.ab/computer/`: `2026-09-28082559-2b9123.jsonl`, `2026-09-28085743-0a36a1.jsonl`, and `2026-09-28085926-4f16cc.jsonl`.

Direct System Events accessibility worked as a workaround: inspect the live AX tree, set focus on the observed text area, type with `keystroke`, and press named buttons with `AXPress`. This completed sign-in, command entry and proposal acceptance in the same Safari instance. The traces establish the failure and workaround, not the cause of the token limit.
