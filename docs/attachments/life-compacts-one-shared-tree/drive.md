/home/mlegls/dev/mlegls-pi__worktrees/life-compacts-one-shared-tree-review-a/docs/attachments/life-compacts-one-shared-tree/drive.md (44 lines)
# Independent first-use drive

Revision: `eb4b58df4082299f409ea67d9a975ec382fb6cde`.

## Predictions before opening the surface

From the ticket and setup guide, I expect:

1. Two separate compactors sharing a fresh local store compete for the same node; only the earliest live lease makes a model call. The other waits and adopts the committed summary without another request, including while idle.
2. A newly opened compactor loads the first committed node for a key even after a conflicting later record.
3. An abandoned lease delays work until expiry, then work resumes without manual synchronization.
4. A local result arriving after a sibling's committed node leaves that first node intact.
5. Cancellation releases the wait and prevents a late node write.
6. The controlled model boundary shows place-bearing input, the turn model, system prompt, tools and cache callback.

## Setup

Required target: local library, fresh temporary SQLite store shared by separate Bun processes; no authentication or model spend. The supplied entry point creates and seeds its own store and cleans it up. I will invoke it from this worker checkout, rather than reuse inherited database selectors. No browser or service is required. Readiness is completion of this setup-and-drive command; the handoff reports its prior successful execution.

Entry point: `bun docs/attachments/life-compacts-one-shared-tree/first-use.ts`.

Implementation, tests, fixtures and runner source were not inspected.

## Encounter and replayable checks

The entry point completed successfully in about three seconds on this checkout. The observations below come from its six public output events; no repository checks or unit tests were run.

| Prediction / check | Observed result | Outcome |
| --- | --- | --- |
| Run two compactors against the same seeded life; accept one model caller and one waiting sibling. | `lease-election`: two leases, earliest sequence 2; builder made one call, sibling zero, with one pending node and no line. | Met |
| Release the winning stream while the sibling is idle; accept the same resolved line with no sibling model call. | `sibling-adoption-during-idle`: both resolved `user@thread-one: winner A`; sibling calls 0, pending 0, summarized 1; store contained one node. | Met |
| Append a conflicting node and reopen; accept the original line. | `first-record-wins-reload`: sequence 4 held the winner, sequence 5 held `LATER duplicate`; fresh loader returned the sequence-4 line. | Met |
| Seed an abandoned lease near expiry and wait without another sync; accept delayed model work and recovered summary. | `expired-lease-recovery`: initially calls 0 / pending 1; call arrived after 1,259 ms, resolved `user@thread-one: recovered after expiry`, then pending settled to 0. Two lease records remained. | Met |
| Commit a sibling node while local output is held, then release local output; accept only the sibling line. | `late-local-result`: resolver and sole node record both retained `user@thread-one: sibling committed first`. | Met |
| Abort a held call and allow its late result; accept released idle and no node. | `cancelled-build`: idle returned with no line; after the result pending was 0, summarized 0, records 0. | Met |
| Inspect the controlled call metadata; accept inherited turn environment and source places. | Both reported calls used `controlled/turn`, `controlled turn system`, `demo_tool`, cache marking true, place-bearing input true. | Met |

Replay each check with the single entry command above and inspect the named event. These are controlled model-boundary encounters, not paid-model or attached-session encounters.

## Frictions and limits

No unresolved user friction encountered on the supplied library entry point. An expectation formed during use was that `idle()` might also imply a zero pending count: the expiry and cancellation events return idle while pending is still 1, then explicitly show it settling to 0. This did not prevent completion or reuse; callers should distinguish visible summary availability from final bookkeeping in this encounter.

The command exited cleanly; its documented cleanup owns child processes and the temporary store. No browser, server, tunnel or external deployment was started. Real attached-session behavior remains owned by `life-session-attachment-and-run-context`, as the ticket specifies. Scored-cut behavior and settings persistence were not separately exercised by this supplied first-use journey; this pass covers the ticket's explicit controlled-compactor first use.


## Review

Read the diff against the ticket and re-ran `first-use.ts` on the review head: all six events unchanged. Findings:

- **Full-log reload on every store write.** `refresh()` called `LifeLog.read()` whenever `version()` changed, and the store is shared machine-wide, so any record from any session re-read the whole life. Measured on 5,000 messages of 2 kB: 57-64 ms per read, at up to 4 Hz per chat. Repaired: `LifeLog.read(from?)` returns positions at or after `from` (backward compatible); `Chat` reads only `read(T)`. Same log, nothing new: 1.2 ms; ten new: 23 ms. An ad hoc append-after-sync check (two messages, then three more, `idle(5)`) resolved all five positions in order.
- **Branch adapter `before()`** re-ran `messagesOf` over the whole branch for every candidate boundary in the context loop (quadratic while summaries lag). Repaired: entry positions are computed once per `synced()` and searched by bisection, as before the change.
- Held without change: lease election and `claim` (earliest lease under ten minutes, own lease kept so it wins on expiry), first-record-wins loading for nodes and scores, late-local-result guard, cancellation, turn-model default, `memory.schemas.life`, unchanged `tree.ts`/`cache.ts`/`score.ts`.
- Not exercised by any packet: scored-cut across processes (loss and overlay edges load through the same first-wins path; the kept `scored` build test covers parsing against durable keys) and settings persistence. Loss scoring has no lease, so two attached compactors may both pay for a scorer call; only the first record is kept.

Re-checked after the repairs: `bun test extensions/context` (35 pass), `bun run typecheck`, `first-use.ts`.
