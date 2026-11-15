---
stage: "ticket"
assignee: "agent"
priority: 3
author: "session:01a1cdb0-4d22-72bc-8778-94e6b358a046"
---
When a reviewer repairs a foreign checkout, its handoff can name the foreign commit bare (`commit: [3aeaaff5, 602606f]`) instead of as `{checkout, commits}`. The foreign-commit check then reports "has no verifiable loaded checkout" every tick, and no resolve action can supply the missing checkout: `retry` re-reads the same handoff. On attention-inbox-in-the-bb-tracker the supervisor merged the bb-plugins branch, still could not get past the hold, and closed the issue by hand after `reconcile_stop`.

Either the review prompt should require `{checkout, commits}` for any commit outside the target repository, or the check should find a bare foreign commit in the repositories the run's constraints and child handoffs already name (here, /home/mlegls/dev/bb-plugins appeared in the child's handoff).

Promoted to a ticket by the 2026-11-16 efficiency audit (@thread:thr_js85m2wmby): both auditors cite @thread:thr_dfgkcug6jp#msg=2072 (reconcile_stop and a hand close on attention-inbox-in-the-bb-tracker) and the two delayed identical holds after it (#msg=2076). The check itself ([[projects/mlegls-pi/issues/verify-foreign-repository-commits-are-installed-before-closing]]) stays as it is.

## tasks

1. Review and implement handoff guidance (`agents/_common.md` or the review prompt): "For commits outside this repository, report `commit: { checkout: /absolute/loaded/checkout, commits: […] }`." The handoff parser refuses a bare foreign SHA at report time, so the worker fixes it in the same turn.
2. For a hold already raised on a bare SHA, the check also searches the repositories the run's constraints and child handoffs name; a resolve action can supply the checkout, after which the ancestry check reruns.
3. Done when: replaying the attention-inbox handoff (`commit: [3aeaaff5, 602606f]`, bb-plugins merged) completes without `reconcile_stop`, and a foreign commit absent from the loaded checkout still holds.
