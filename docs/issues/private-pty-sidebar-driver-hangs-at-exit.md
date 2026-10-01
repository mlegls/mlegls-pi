---
stage: idea
assignee: agent
author: session:01a0f7df-1138-76f0-8476-747adc5e73d9
---

During [[projects/mlegls-pi/stories/work-in-threads]], temporary Python stdlib pty/subprocess drivers completed every recorded sidebar action, then their enclosing bash calls timed out at 90 and 150 seconds rather than returning. No temporary driver process remained afterward; their frame files and isolated registry inventories existed. The product CLI itself and the native Ghostty launcher returned normally.

The scripts called `side.wait`, terminated the direct zmx main client and closed both pty masters. The source of the wait is unlocated (pty subprocess teardown versus the host's inherited stream capture). Workaround: use the committed interactive fixture and native launcher rather than depending on those temporary scripts as a verifier entrypoint. [Frames and native first use](../attachments/tree-sidebar-over-threads/index.md).
