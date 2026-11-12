---
stage: "idea"
assignee: "agent"
priority: 3
author: "session:01a1cdb0-4d22-72bc-8778-94e6b358a046"
---
When a reviewer repairs a foreign checkout, its handoff can name the foreign commit bare (`commit: [3aeaaff5, 602606f]`) instead of as `{checkout, commits}`. The foreign-commit check then reports "has no verifiable loaded checkout" every tick, and no resolve action can supply the missing checkout: `retry` re-reads the same handoff. On attention-inbox-in-the-bb-tracker the supervisor merged the bb-plugins branch, still could not get past the hold, and closed the issue by hand after `reconcile_stop`.

Either the review prompt should require `{checkout, commits}` for any commit outside the target repository, or the check should find a bare foreign commit in the repositories the run's constraints and child handoffs already name (here, /home/mlegls/dev/bb-plugins appeared in the child's handoff).
