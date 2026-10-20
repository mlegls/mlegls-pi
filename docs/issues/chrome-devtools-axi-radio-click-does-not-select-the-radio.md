---
stage: "idea"
assignee: "agent"
author: "session:lay-settings-out-as-one-scrolling-document-review-o"
priority: 3
---
Seen in the concept repository's Settings document drive (2026-10-20). chrome-devtools-axi MCP click on a rendered radio (Language 简体中文) reported success twice but the radio stayed on Automatic and Save stayed disabled; fill(value=true) likewise changed nothing. A DOM input.click() on the rendered input selected it at once. No product defect established. Replay: signed-in concept Settings at 390, anchor Language, snapshot, click the Chinese radio uid, fresh snapshot and read its checked state. Expected: Chinese checked. Workaround: DOM click on the visible input. Cause not located: whether the uid resolves to a visually hidden input under the styled label is the thing to check. Related: chrome-devtools-axi-css-submit-click-did-not-advance-a-quiz.
