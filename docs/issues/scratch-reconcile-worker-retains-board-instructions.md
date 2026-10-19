---
stage: "done"
author: "session:9b877253-edb5-49b9-963e-dfbf6658a23a"
---
First-use of move-coordination-off-the-board (branch eebff096) via its absolute reconcile CLI from a disposable /tmp repo launched thr_7d5fywy4nh. Its initial bb message still instructs decision posts through tools.board_send and tools.board_read, despite the branch removing board coordination. Read with bb thread log thr_7d5fywy4nh --all. Actual constraint delivery and reports succeeded through bb; runtime instruction mismatch remains. Setup had no local agents roster. Cause not inspected by independent driver; may be installed template selection. Evidence: docs/attachments/move-coordination-off-the-board/live.md. Origin story: board-free worker coordination.

## Result

Not a defect in the change: workers get their preamble from AGENTS_DIR, which defaults to ~/.pi/agent/agents, a symlink to the canonical checkout /Users/mlegls/dev/mlegls-pi/agents. The candidate CLI ran against the unmerged canonical copy, whose _common.md still had the decision/board paragraph. The branch deletes that paragraph (agents/_common.md, agents/roles/handle.md); it takes effect when the branch lands.
