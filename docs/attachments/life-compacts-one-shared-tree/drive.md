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
