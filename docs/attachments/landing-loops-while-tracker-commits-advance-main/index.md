# Landing while the tracker commits

Run the [local reconciler fixture](../probe-conflicts-and-prepare-deps-around-integrate/fixture.ts) from a checkout with `mise run setup` completed:

```sh
bun docs/attachments/probe-conflicts-and-prepare-deps-around-integrate/fixture.ts tracker-race
```

The fixture seeds a reviewed worker, a main checkout, and an unrelated tracker write. The gate exits once a real `git commit --only` holds main's index lock. The writer finishes two seconds later. No sign-in or live workers are needed; the fixture owns and removes its processes and temporary checkouts.

With the fixture on `fb3d7737`, the fast-forward hit `index.lock: File exists` and sent the reviewer back. At `a8e62ec7`, the same setup landed with `done: true`, `order: ["gate"]`, no integration-failure message, and both the reviewed head and the tracker commit as parents of the landing. The existing tracker-only catch-up ran after Git released the lock. The four affected test files passed (23 tests); `bun run typecheck` passed.

## Independent drive

Predictions before running the handoff:

- A reviewed worker should land despite a concurrent tracker-only commit. The disposable replay should finish with `done: true`, `order: ["gate"]`, and no integration failure or second review.
- On Concept, a landing during concurrent reconciler activity should report success on attempt one or two. The evidence should identify the landing, intervening tracker-only commits, and attempt count. The disposable replay alone cannot observe this.

`82b82200`: `mise run setup` completed, then `mise exec -- bun docs/attachments/probe-conflicts-and-prepare-deps-around-integrate/fixture.ts tracker-race` exited 0 in 13 seconds. The disposable checkouts needed no sign-in or service. The CLI printed `landed fixture in the owner's checkout`, `done: true` and `order: ["gate"]`, with no integration failure. `landedParents` contained the reported `childBefore` followed by a second parent, and `trackerLanded` contained the concurrent tracker update. The local expectation was met. No tooling friction or services left running.

To replay the local check, run the command above and require one `gate`, `done: true`, the reviewed head as a landing parent, and the concurrent tracker text in `trackerLanded`.

The Concept expectation was met by replaying historical receipts. In Concept's Git common directory, read `reconcile/tutor-recording-cannot-bind-srs-identities-through-code-calls.json`: the log has one review launch at `00:46:13` and a landing at `01:17:35` UTC with no intervening integration failure. Other runs' logs record `hub-invites-retry-while-update-waits-for-dependent-review-6` at `01:15:00` and `publish-the-relicensed-open-packages-under-new-versions-review-4` at `01:16:25`. To verify the landing against Git, inspect `git show -s --format='%H %P %s' fdba2962ac` and `git diff --name-only 57852934be a0a96e03be` from Concept: the two landing parents must match the receipt's prepared head and the concurrent tracker tip, and only the two archived issue Markdown files below that tracker tip should be changed. This establishes a first-attempt Concept landing under concurrent reconcilers; it does not establish that the index lock overlapped that specific live landing. The lock overlap is covered by the disposable replay.

## Concept history

The existing tracker-only catch-up path can be seen on Concept main in `fdba2962ac` (`tutor-recording-cannot-bind-srs-identities-through-code-calls`, 2026-11-20 01:17:35 UTC). Its reconciler log records one review launch and no integration failure before landing, while other reconcilers were launching review and drive workers. The landing receipt records base `57852934be` and prepared head `dd6d18a3d1`. During preparation main advanced through `c2bea11043` and `a0a96e03be`, both under `docs/issues/`; those commits reached the landing through its second parent. The reviewed head remained its first parent. `2cf9b11027` (`record-the-posed-answer-apart-from-the-learners-question`) shows the same first-attempt catch-up with one intervening tracker commit. These are historical live landings; the held-index race was reproduced in the local fixture.

## Review

On `68a5acbd` the tracker-race replay completed with `order: ["gate"]`, `done: true`, the reviewed head as first parent and the concurrent issue present. The 14 existing lifecycle, landing and landing-cleanup checks passed. In Concept, the consecutive review-launch and landing log entries and both parents of `fdba2962ac` match the drive record.
