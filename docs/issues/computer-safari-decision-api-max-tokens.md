---
stage: idea
author: session:01a0e6e8-77cb-7796-a17b-1733f8c6d4f0
---

During the final Safari pass of [[projects/concept/issues/archive/check-zh-cn-font-stacks-in-safari]], `ab computer --app Safari` was used on the authenticated local Application Session in Safari 26.0.1. The first call ran for 930 seconds and ended with `Decision API: HTTP 400 max_tokens_exceeded` after zero actions. Scoped retries abstained at step 0. Trace JSONL files in the originating session's `.ab/computer/`: `2026-09-28082559-2b9123.jsonl`, `2026-09-28085743-0a36a1.jsonl`, and `2026-09-28085926-4f16cc.jsonl`.

Direct System Events accessibility worked as a workaround: inspect the live AX tree, set focus on the observed text area, type with `keystroke`, and press named buttons with `AXPress`. This completed sign-in, command entry and proposal acceptance in the same Safari instance. The traces establish the failure and workaround, not the cause of the token limit.

2026-09-30 recurrence on the **Playwright browser**, not Safari: Concept's [[projects/concept/attachments/record-goal-change-and-new-evidence-map-history/index|recorded Go-history drive]] ran `ab computer --browser .wm/history-drive.ts --budget 1` to accept its new-evidence Map proposal. It returned `Decision API: HTTP 400: {"detail":{"error_type":"max_tokens_exceeded"}}` at step 0, zero actions, after the Session accumulated several whole-graph previews and the adopted official Map's many Materials. Trace `2026-09-30T12-26-08-779Z-f2a5cf.browser.jsonl` in session `01a0f228-0d53-707d-be6c-a6c111099efd`. This does not establish which part exceeded the limit. Workaround: fresh DOM inspection, then deterministic click of the last pending Map card's ordinary Accept and wait for its Accepted state.

2026-09-30 naming-ticket browser drive recurrence: after selecting OpenRouter in the Settings default-chat-model picker, its unfiltered model catalog produced `HTTP 400 max_tokens_exceeded` at step 7 (four actions already delivered). Trace `2026-09-30T14-04-33-565Z-86f058.browser.jsonl`, session `01a0f28a-fd13-73f4-ac4e-7f65ac17ee20`. Workaround: direct Playwright fill of the same model combobox with `openai/gpt-5-mini`, then click its exact semantic option, reducing the catalog to two results. [[projects/concept/attachments/name-things-by-their-names-not-ids/index|Packet]].
