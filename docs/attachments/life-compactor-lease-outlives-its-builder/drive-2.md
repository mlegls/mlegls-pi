# Independent CLI drive

Tested revision: `ce349347786c0db00a1b5781f3c8224a0fc568b4`, 2026-11-12. CLI-only encounter; visual false, no screenshots. No source, diff, tests or fixtures inspected. Only the ticket, life README, setup packet, generated store records and actual CLI were used.

## Predictions recorded before use

- A session stopped while summarizing returns its leases; a sibling builds without the old 30-second first-request stall. **Met** for orderly RPC EOF. SIGTERM behaves as abrupt death instead, also recovered.
- A killed builder permits a sibling to build within about one minute. **Met**.
- Attaching to 17 imported long messages drains all summaries even if startup replaces its Chat; the session can then end. **Met**.
- An observable build failure returns its leases for the next run. **Met**, including a real empty-reply failure and later sibling reconstruction.

## Setup and readiness

Fresh driver-owned roots created by `bun scripts/life-playground.ts prepare-agent`, then `bun scripts/life-playground.ts seed-long <root> 17`. Each setup exited zero and reported 17 added messages before launching pi. Inherited `/tmp/pi-life-P57omu` belonged to implementation and was not reused. Real Concept Engineering records were untouched.

Deployment: isolated local playgrounds loading this worker checkout. Persona: generated named observatory agent. Authentication: existing host Anthropic configuration. Model: Haiku 4.5. Root names below also identify the machine-wide life, e.g. `/tmp/pi-life-aDCCbb` → `/pi-life-aDCCbb`. Store: `<root>/store/records.db`. Each imported position 0–16 is a long message.

Entry point:

```sh
bun scripts/life-playground.ts start <root> one --print 'Reply ready.'
```

No server, browser, tunnel or container required. Every launched CLI and orchestration process exited. Disposable data retained for replay.

## Encounter

| Journey | Owned root | Observed outcome |
| --- | --- | --- |
| Startup attachment / discarded Chat | `/tmp/pi-life-aDCCbb` | Exit zero in 14 seconds; all imported leaves 0–16 built; 31 claims, 31 matching ends. |
| SIGKILL while leases held | `/tmp/pi-life-h0KkuD` | Holder PID 3911679 killed; sibling PID 3911810 reclaimed positions 0–7 within 0.95 seconds; all 17 imported leaves built within 35.3 seconds of first claim. Sibling exited zero 37.8 seconds after kill. |
| SIGTERM while leases held | `/tmp/pi-life-h3mhAq` | Holder PID 3911690 exited 143; its eight claims had no ends. Sibling PID 3912030 rebuilt all 17 imported leaves by 8.6 seconds after first claim, exited zero 15.9 seconds after signal. This exercises abrupt termination, not orderly shutdown. |
| Orderly RPC EOF while leases held | `/tmp/pi-life-97TT4T` | EOF sent after observing 11 leases; holder exited zero. At exit 16 claims had 16 ends and no nodes. A sibling then built all imported leaves, exited zero in 39.2 seconds despite two empty-reply warnings. Final 50 claims had 50 ends. |
| Failed summary retried by later session | `/tmp/pi-life-aDCCbb` | A failed level-1 position-7 claim ended immediately; a later sibling built that same key in 2.8 seconds after claiming it, well before original lease expiry. |

### Startup and discard — held

In `/pi-life-aDCCbb`, PID 3907963 claimed level-0 positions 0–7 at `06:16:32.914–.921Z`. Matching ends followed at `.925–.932Z`, joined by each end's `life.lease` tag to the original record ID. Replacement claims on those same life/fanout/level/position keys followed at `.933–.940Z`. First node arrived at `06:16:35.094Z`; the last imported leaf, position 1, built at `06:16:38.894Z`. The process remained alive through replacement and exited successfully at about `06:16:46Z`. No imported line remained unbuilt.

### Dead holder / first request — held

The SIGKILL holder's eight lease records have no ends. The sibling nevertheless claimed the same keys at `06:17:17.824–.831Z`, versus original claims at `06:17:16.878–.885Z`. Its replacement Chat ended and reclaimed its own startup claims immediately. The dead holder did not impose a 30-second election wait: rebuilding those keys began within one second. Most imported leaves completed by `06:17:24.581Z`.

The whole request still took 37.8 seconds because a new local build failed (empty reply): leaf 1's new claim `mwd5obh0-yhqcmv` ended at `06:17:21.979Z`; retry claimed at `06:17:48.965Z` and built at `06:17:52.086Z`. This is distinct from waiting on a gone holder. All 17 imported positions were built within about a minute.

### Failure and later sibling — held

The first `/pi-life-aDCCbb` run emitted `life: compaction failed: empty reply`. All 17 imported leaves still built; the missing summary was higher-level key `["/pi-life-aDCCbb",2,1,7]`, claim `mwd5nh6l-4hm74r`, ended at `06:16:40.516Z` without a node.

A second slot (`two --print 'Reply only ready. Do not call tools.'`) reclaimed that key at `06:18:42.490Z`, but its short request exited before the summary completed; all its leases ended. That was a new expectation formed while using the product: a very short run can end before higher-level work drains. It leaves the key available rather than stranding it.

A third slot used `three --print 'Use bash to run sleep 10, then reply ready.'`, allowing compaction to drain during ordinary work. PID 3923244 claimed the failed key at `06:19:29.280Z`, wrote its node at `06:19:32.082Z`, ended the claim at `.084Z`, and exited successfully after 14 seconds. The original ten-minute expiry would have been `06:26:38Z`.

## Frictions

- Real Haiku compaction sometimes emits `life: compaction failed: empty reply`. Continuing works, but a fresh local failure can still make a request take about 30 seconds. Added this encounter to the existing owner: [life-first-use-compaction-empty-reply-warning](../../issues/life-first-use-compaction-empty-reply-warning.md). No provider payload/stop reason was inspected.
- `Reply ready.` often produced several paragraphs discussing the imported observations. This did not affect the lease checks; the final explicit sleep task returned `Ready.`.

## Replayable checks

1. **Discard:** prepare-agent → seed-long 17 → start one with `--print`. Query this root's records only. Join `life.lease.end` tag `life.lease` to lease record ID; join nodes and claims by `life.key`. Accept immediate ends/reclaims of startup positions 0–7 and nodes for all imported positions 0–16 by session exit.
2. **Hard death:** launch first CLI with piped output; observe its first `life.lease` record, read that record's `life.pid`, then SIGKILL exactly that owned PID. Await launcher exit, start slot two immediately. Accept same-key replacement claims before 30 seconds and all imported nodes within about one minute. Do not signal by name or pattern.
3. **Shutdown:** launch `start <root> one --mode rpc` with piped stdin held open. After leases appear, close stdin and await zero exit. Accept an end for every claim at holder exit; start slot two and check imported nodes. No synthetic leases or mutated stores are needed.
4. **Build failure:** if the real empty-reply warning occurs, find a claim ending without a node. Start a later slot and give it a short real task (e.g. bash sleep 10). Accept same-key claim and node before old expiry. Keep warning timing separate from dead-holder election timing.
5. **Read-only record inspection:** use `bun:sqlite` Database with `{readonly:true}` on the owned root. `records` carries `id,ts,schema`; `tags` joins on `record=records.seq`. Node position tags are `life.l=0` and `life.i`; filter the exact `life.id`. Never read the real life store.

## Cleanup and limits

All launched processes ended. No services remain. These are live credentialed CLI encounters, not unit tests or mocked model streams. Wall times include provider latency; same-key record timestamps establish recovery independently of total request duration. Stores remain under the four named `/tmp` roots. The original setup packet remains in [index.md](index.md).
