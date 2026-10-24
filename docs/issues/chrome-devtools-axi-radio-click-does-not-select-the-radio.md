---
stage: "idea"
assignee: "agent"
author: "session:lay-settings-out-as-one-scrolling-document-review-o"
priority: 3
---
Seen in the concept repository's Settings document drive (2026-10-20). chrome-devtools-axi MCP click on a rendered radio (Language 简体中文) reported success twice but the radio stayed on Automatic and Save stayed disabled; fill(value=true) likewise changed nothing. A DOM input.click() on the rendered input selected it at once. No product defect established. Replay: signed-in concept Settings at 390, anchor Language, snapshot, click the Chinese radio uid, fresh snapshot and read its checked state. Expected: Chinese checked. Workaround: DOM click on the visible input. Cause not located: whether the uid resolves to a visually hidden input under the styled label is the thing to check. Related: chrome-devtools-axi-css-submit-click-did-not-advance-a-quiz.

2026-10-23 concept Plan language encounter, 1280×900, revision 7250be3: MCP click on Language radio English (`16_116`) failed to become interactive within its timeout. Clicking the rendered label via DOM selected it successfully. Waited for document locale and checked radio to settle before navigation; navigating immediately after a click can otherwise capture the preceding locale. No product defect established. Origin/evidence: concept docs/attachments/drive-plan-language-in-simplified-chinese-and-english/joined.md. Existing label-click workaround recovered the drive.

2026-10-24 concept independent Chinese-truncation drive (65c69c77): MCP click/fill of the sr-only interface-language radios timed out again; clicking their visible enclosing label via DOM succeeded. Also seen there: initial `new_page` navigation timed out and `navigate_page` retry worked. Moved from concept `chrome-mcp-fill-success-does-not-establish-input-delivery`. Evidence: [[projects/concept/attachments/drive-plan-language-in-simplified-chinese-and-english/independent-truncation-redrive]].
