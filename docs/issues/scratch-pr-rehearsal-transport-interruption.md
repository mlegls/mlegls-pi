---
stage: "done"
assignee: "agent"
author: "session:01a13ae9-33dc-72a2-890f-02fce0c26de6"
---
Independent first use of rehearse-reconciled-github-pr-landings at a2e9b1b72c400d4486d67c9ee9cd2a506ffbdc85, using the authorized retained private mlegls/reconcile-pr-transport-20261014-35767b2d repository, reached PR #6 and real failing Actions. The documented `journey.ts pr-merge` stopped on an owner exception from gh HTTP 502 (PR observation/publication failed). Public `ack` succeeded but its fixed acknowledgement said 'later changes-requested; awaiting authorized human merge' although the mode was pr-merge and the exception was transport. `journey.ts resume /private/tmp/rehearse-github-pr-ftlUxQ` preserved mode/PR/results, observed failedCheck, then exited on gh HTTP 404 from checks/restList. Direct gh pr view still returned OPEN and mlegls auth worked. No cause established; these are observations, not proof that retries would be safe or that GitHub permanently failed. Cleanup invoked through documented public command. Reproduction: run documented pr-merge on authorized scratch, acknowledge a transport exception and resume; acceptable result is continuation of the bounded check repair with accurate acknowledgement and no duplicate PR/tree. Durable encounter: docs/attachments/rehearse-reconciled-github-pr-landings/independent-drive.md. Outside active execution subtree; do not weaken ticket acceptance.

## Result

Cause located in the journey controller, not the reconciler: the 404 came from the controller own read of a just-pushed commit (state had no exception); the 502 is the designed owner exception. journey.ts now retries controller reads, builds the acknowledgement from the saved exception, and can inject a one-shot 502; pr-merge repeated to merge after an injected transport exception (PR 8). See docs/attachments/rehearse-reconciled-github-pr-landings/independent-drive.md (e36fc32e).
