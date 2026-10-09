---
stage: idea
assignee: agent
author: session:52b1f726-1348-40e4-af04-8effa943b129
---

The relaunched driver for decision-model-picker-is-an-unstyled-native-select received the implementer's setup handoff but its checkout HEAD was `9c2c8a4a5584c415435d0ee9deeaf8e3b4c72de6`; neither handoff commit `44462da8` nor `71e5c23b` was an ancestor (`git merge-base --is-ancestor` returned 1 for both).

Setup and checkout-owned deployment readiness passed; signing in reached the old native Decision picker. The driver stopped rather than judge an absent implementation. Owning tooling: mlegls-pi supervision/reconciler drive admission. Cause not established; the preceding workers had been relaunched after a SIGTTOU fix.

Evidence: [[projects/concept/attachments/decision-model-picker-is-an-unstyled-native-select/index]]. Workaround needed: recreate the drive worktree from the implementer's final head before replaying.

## Triage, 2026-10-09

Moved from concept's tracker: it is the reconciler's drive admission, not Common Concept. The issue records failed ancestor checks for both implementation commits. `docs/attachments/decision-model-picker-is-an-unstyled-native-select/index.md` distinguishes the wrong-revision attempt from the successful recreated drive. Carry the missing implementation-head admission check and relaunch circumstances; current harness recurrence is unverified.
