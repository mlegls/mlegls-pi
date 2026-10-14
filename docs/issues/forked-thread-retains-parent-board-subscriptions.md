---
stage: idea
assignee: agent
author: session:01a0f71c-7077-753f-9e63-0ebda24a595d
---

During [[projects/mlegls-pi/issues/archive/thread-registry-and-zmx-launch]] independent first use, fork `5e52b9a3-1f69-4e7e-9168-143f9139cebd` reported its own fresh `fork-report-ok` correctly, but readLive listed restored subscriptions to parent `thread/d051621c-a450-43ab-8fe7-28892059e38e` and `mail/2059e38e`, not its own thread topic. Its own mailbox and worktree topic were also present. The unrelated parent's report remained unchanged.

Observed through committed `fixture.ts prepare`, `inspect`, then a literal prompt to the fork and `inspect` again; no source inspected and no cross-wake stimulus sent. Decide whether forked thread wake routing should inherit canonical parent thread/mail topics; if not, give restoration/remapping an owner. Originating story (retired with the Threads GUI): [[projects/mlegls-pi/issues/archive/threads-on-zmx-with-a-native-sidebar]]. [Evidence and replay check C7](../attachments/thread-registry-and-zmx-launch/driver-log.md).
