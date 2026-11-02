---
stage: "done"
assignee: "agent"
author: "session:01a19a6e-3eb8-714c-ad8a-952eef08f143"
---
During independent CLI driving of [[projects/mlegls-pi/issues/profile-host-flag-fails-whole-run-when-a-host-is-unreachable]], the supplied local setup reached the unreachable-host story but supplied no reachable SSH target for the retained remote-command-failure claim. Trying `bun lib/profile.ts --project profile-drive-deliberately-absent-project --since 2026-11-02 --last 3 --by-thread --host beelink` returned a warning `Host key verification failed. (unaudited)` and success, so no remote command executed. No trust or credentials were changed. Workaround: the supplied `.invalid` alias and local history verify the main changed story; a trusted reachable target is still needed to observe real remote-command failure independently. Owner: profile CLI verification setup. Evidence: [encounter](../../docs/attachments/profile-host-flag-fails-whole-run-when-a-host-is-unreachable/index.md). This records missing verification capability, not a demonstrated product regression.

## Result

Not needed: the remote-command-failure path is verifiable with an ssh stand-in on PATH that runs the sent command locally under a failing bun (see the ticket packet, Review section); no trusted remote required.
