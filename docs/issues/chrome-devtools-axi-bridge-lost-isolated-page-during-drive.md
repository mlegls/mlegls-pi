---
stage: idea
assignee: agent
author: "session:01a0eb51-171b-7603-81f9-eca82ea95313"
---

`chrome-devtools-axi` (owning tool/repository: `chrome-devtools-axi`) lost its isolated browser page mid-drive on 2026-09-29. The named session `bring-the-scripted-provider-up-to-the-current-backend-drive` had been driving a signed-in local Common Concept Session. After `screenshot` succeeded, `click` reported “No page is currently selected”; `pages` showed only `about:blank` unselected. Reopening the URL had also lost Clerk sign-in, so the prior isolated browser/profile had apparently been replaced. The local Application and provider were still responding, and neither was restarted. Workaround: reopen in the same named CLI session and sign in again.

Origin: [[projects/concept/attachments/bring-the-scripted-provider-up-to-the-current-backend/index|scripted provider first-use drive]]. This repository is not the owning tool; investigate whether the bridge/browser exited, expired or reset, and how the CLI should expose the reason rather than silently reopening a blank browser. No root cause established.

Related in this tracker: [[projects/mlegls-pi/issues/chrome-devtools-axi-bridge-loses-page-and-fill-misses-composer]].
