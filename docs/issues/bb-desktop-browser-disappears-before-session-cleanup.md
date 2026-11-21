---
stage: "done"
author: "session:thr_swr7jtjcxn"
---
During the [Outreach drive](../attachments/tracker-outreach-panel-for-project-vaults/index.md), an active signed-in desktop automation session stopped after roughly six minutes; Mac host discovery then returned no instances. Both close attempts returned HTTP 502: Desktop browser instance is unavailable or generation is stale. The normal close retry could not establish whether the owned tab was removed. Observed by @thread:thr_swr7jtjcxn.

## Result

Duplicate of [get-bb/bb#7534](https://github.com/get-bb/bb/issues/7534#issuecomment-7062553249); added the Outreach occurrence there. Rediscovery and a new owned tab restored control in review.
