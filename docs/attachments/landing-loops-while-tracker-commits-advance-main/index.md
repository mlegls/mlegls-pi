# Landing while the tracker commits

Run the [local reconciler fixture](../probe-conflicts-and-prepare-deps-around-integrate/fixture.ts) from a checkout with `mise run setup` completed:

```sh
bun docs/attachments/probe-conflicts-and-prepare-deps-around-integrate/fixture.ts tracker-race
```

The fixture seeds a reviewed worker, a main checkout, and an unrelated tracker write. The gate exits once a real `git commit --only` holds main's index lock. The writer finishes two seconds later. No sign-in or live workers are needed; the fixture owns and removes its processes and temporary checkouts.

With the fixture on `fb3d7737`, the fast-forward hit `index.lock: File exists` and sent the reviewer back. At `a8e62ec7`, the same setup landed with `done: true`, `order: ["gate"]`, no integration-failure message, and both the reviewed head and the tracker commit as parents of the landing. The existing tracker-only catch-up ran after Git released the lock. The four affected test files passed (23 tests); `bun run typecheck` passed.

## Concept history

The existing tracker-only catch-up path can be seen on Concept main in `fdba2962ac` (`tutor-recording-cannot-bind-srs-identities-through-code-calls`, 2026-11-20 01:17:35 UTC). Its reconciler log records one review launch and no integration failure before landing, while other reconcilers were launching review and drive workers. The landing receipt records base `57852934be` and prepared head `dd6d18a3d1`. During preparation main advanced through `c2bea11043` and `a0a96e03be`, both under `docs/issues/`; those commits reached the landing through its second parent. The reviewed head remained its first parent. `2cf9b11027` (`record-the-posed-answer-apart-from-the-learners-question`) shows the same first-attempt catch-up with one intervening tracker commit. These are historical live landings; the held-index race was reproduced in the local fixture.
