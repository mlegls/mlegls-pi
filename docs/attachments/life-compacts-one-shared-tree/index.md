# Shared life compactor first use

Tested revision: `42602a196a50e187354d5d8ec8e0067c67624fbb`.

Two separate compactors shared one temporary records store. A made one controlled model call; B made none and picked up A's node while blocked in `idle()`. A fresh loader kept the first record after a duplicate was appended. A waiting compactor recovered when an abandoned lease expired, and a late local result left a sibling's committed node intact.

## Setup and replay

Required and prepared environment: local library first use with a temporary SQLite records store and a controlled worker-stream boundary. The owning checkout is branch `life-compacts-one-shared-tree-implement-8`; no server or remote target is involved. No persona, credentials or source session files are needed.

From the repository root:

```sh
bun docs/attachments/life-compacts-one-shared-tree/first-use.ts
```

[The entry point](first-use.ts) creates a fresh `PI_BOARD_DIR`, seeds copied messages, and launches separate Bun compactor processes. The processes use the real `Chat`, `LifeLog`, records store, leases and polling. Only their model stream is controlled: each reply waits for an explicit release, with no model spend. The abandoned lease is seeded with 1.5 seconds left in its ten-minute lifetime. The script closes its processes and deletes its temporary store in `finally`.

## Observations

| Claim | Action and observed result |
| --- | --- |
| One lease winner | A's stream was held open while B started on the same life. There were two lease records; A made one call, B made zero. B had one pending node and no line before A committed. |
| Adoption during the first request's wait | B entered `idle()` before A's stream was released. B returned with `user@thread-one: winner A`, one summarized message, zero pending nodes and zero model calls. A resolved the same line; the store held one node record. |
| First committed record wins on loading | After A's node at sequence 4, a conflicting node was appended at sequence 5. A fresh `Chat` loaded `user@thread-one: winner A`, ignoring `LATER duplicate`. |
| Abandoned lease expires and retries | A compactor started with zero calls and one pending node behind a seeded abandoned lease. Without another `sync()`, it called the controlled stream after 1,255 ms, committed `user@thread-one: recovered after expiry`, and settled at zero pending nodes. |
| Late local output preserves a sibling's winner | While a local stream was held open, a sibling node was committed. Releasing `LOCAL late result` left only `user@thread-one: sibling committed first` in the store and in the local resolver. |
| Cancellation | Aborting during a held stream released `idle()`. Even when that stream later returned output, no node was written, no line resolved, and pending work settled to zero. |
| Turn model, system prompt, tools and cache marking | Each controlled call used `controlled/turn` with no configured compactor model, the turn's `controlled turn system`, and `demo_tool`. The stream received the cache-marking callback and a place-bearing `user@thread-one: ...` input. |

This is nonvisual library evidence. Real attached-session first use belongs to [[projects/mlegls-pi/issues/life-session-attachment-and-run-context]].

## Existing regression checks

```sh
bun test extensions/context/life/build.test.ts extensions/context/life/log.test.ts extensions/context/life/tree.test.ts
bun run typecheck
```

Observed: 14 tests passed, zero failed, 9,485 assertions; TypeScript passed. The kept build tests now use durable life logs and place-bearing lines. No assertions were weakened or removed. `tree.ts`, `cache.ts` and `score.ts` are unchanged.

## Runtime join

The compactor surface is `new Chat(fanout, settings)` followed by `sync(lifeLog(id), env)`. `env.signal` stops polling, releases idle waiters and cancels model work. `dispose()` stops watching a discarded chat; the caller's signal owns in-flight requests. Node keys contain life id, fanout, level and index. Node tags use `life.id`, `life.key`, `life.b`, `life.l`, `life.i` and `life.model`; score records use `life.scores` and `life.loss`, with the existing score and overlay edges.

The moved runtime remains loadable through a read-only branch adapter in `extensions/context/life/index.ts`. [[projects/mlegls-pi/issues/life-session-attachment-and-run-context]] replaces that adapter with the attached durable life and owns saved views and run boundaries.
