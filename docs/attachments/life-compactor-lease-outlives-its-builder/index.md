# Lease lifetime first use

Implementation starting ref: `4cced27f40471e19cbb2dcc9f72e9b63d319d7a1`. Nonvisual library and CLI encounters; all stores below are disposable playgrounds. The real `/concept-engineering` store was untouched.

## Setup for independent driving

From the worker checkout:

```sh
bun scripts/life-playground.ts prepare-agent
bun scripts/life-playground.ts seed-long <returned-root> 17
bun scripts/life-playground.ts start <returned-root> one --print 'Reply ready.'
```

`prepare-agent` creates a named local observatory agent, its own git workspace, settings and records store. Its generated extension loads this checkout. Each root's `life-playground.json` identifies its life; records live in `<root>/store`. The persona is the disposable observatory agent. Real calls use the host's existing Anthropic authentication and Haiku 4.5; the setup creates no credentials. `seed-long` is idempotent by source and rejects directories without the playground marker. Use separate slots (`one`, `two`) for sessions on the same life. Omit `--print` and use `--mode rpc` for controllable session lifetimes.

The prepared real-call target is `/tmp/pi-life-P57omu`, life `/pi-life-P57omu`, owned by this implementation encounter. Its first session finished successfully and no process remains running. For a fresh startup reproduction, create a new playground rather than reusing its already-built leaves.

## Observations

A temporary controlled-stream diagnostic used the public `Chat.sync`, `Chat.idle`, `Chat.dispose`, `LifeLog` and abort-signal surfaces. It created its stores with the playground's `prepare` and `seedLong`, then ran two independent Bun processes per life. The first process held a model reply open; the sibling's first `idle(..., 30000)` began while the lease was held. No model requests or credentials were used for these four encounters.

| Holder action | Playground / life | Sibling's first wait | Summarized |
| --- | --- | --- | --- |
| Abort and dispose, then exit | `/tmp/pi-life-sanrMm` / `/pi-life-sanrMm` | 3 ms | 1 / 1 |
| Dispose the Chat, keep its process alive | `/tmp/pi-life-ZKbF34` / `/pi-life-ZKbF34` | 2 ms | 1 / 1 |
| Reject the model reply with a controlled failure | `/tmp/pi-life-wtVJTy` / `/pi-life-wtVJTy` | 1 ms | 1 / 1 |
| SIGKILL the holder process | `/tmp/pi-life-3FO5se` / `/pi-life-3FO5se` | 1003 ms | 1 / 1 |

The lease PID pairs (holder, sibling), joined by the lease's life/key tags, were `(3897887, 3897929)`, `(3897992, 3898088)`, `(3898218, 3898266)` and `(3898297, 3898326)` respectively. The first three stores had two lease-end records, one for each claim. The hard-kill store had only the sibling's lease-end record; its holder could write none. All diagnostic processes exited.

The existing replay also passed:

```sh
bun docs/attachments/life-compacts-one-shared-tree/first-use.ts
```

It observed one election winner, sibling adoption during idle, first-record-wins reload, expiry of a preexisting lease without a PID, preservation of a sibling's committed node against late local output, and cancellation without a late node write.

## Named-agent attachment startup

The real CLI command above was opened on `/tmp/pi-life-P57omu`, seeded with 17 long messages at positions 0–16. It reproduced the double claim: the first Chat claimed positions 0–7 at `2026-11-12T06:12:33.787–.794Z`; startup discarded it, writing eight matching lease ends at `.798–.805Z`. The replacement Chat claimed those positions at `.806–.813Z` and built all eight by `06:12:39.164Z`. The session stayed alive throughout this replacement.

At process exit all 17 imported positions had `life.node` records. All 31 leases written during the encounter had matching `life.lease.end` records; none remained held. The CLI exited successfully after 39 seconds.

One model call emitted `life: compaction failed: empty reply`. Position 11's lease was released at `06:12:40.655Z`; the next sync retried it and committed its node at `06:13:08.202Z`. This explains the 30-second first-request wait in this particular real-call encounter: the failed local build, rather than the discarded Chat's leases. The existing [empty-reply issue](../../issues/life-first-use-compaction-empty-reply-warning.md) owns that observation; no provider payload or stop reason was captured. The controlled encounters above isolate waiting on a gone holder.

## Checks

- `bun test extensions/context/life/build.test.ts extensions/context/mechanism.test.ts`: 7 passed, 0 failed.
- `bun run typecheck`: passed.
- No new tests or assertion changes.
