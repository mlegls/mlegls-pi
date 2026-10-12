# Independent parent drive

## Predictions before opening the surface

- Collector/owner journey: b starts only after a lands in the root collector; canonical a and b remain open and a is derived in-flight. The outside dependent remains blocked until root delivery to the owner, then a/b/root close and outside becomes frontier.
- Failed refinement: children created before failure disappear, without deleting unrelated issues.
- Sparse instruction journey: a worker has no docs/issues; CLI there reads/writes the canonical tracker, and role instructions remain usable across child joins.

## Setup

Required deployment: isolated temporary Git/vault repositories, owned by this replay. Fixture identity, no authentication. Seeds: root/a/b/outside plus provisional children. Entry: `bun docs/attachments/reconcile-against-a-global-tracker/rehearse.ts all`. Merge cd74ca0 committed before setup. No inherited deployment reused. Final setup completed successfully on tested revision `b2c82c1`.

## Encounter and results

Final entry exited 0 after 7m31s: vault plus all nine runtime modes held. This is a nonvisual CLI/library encounter using registered shell workers, not an AI decision run.

| Prediction / action | Observed state | Outcome |
| --- | --- | --- |
| Collector → owner | At owned target `/private/tmp/rc-global-ledger-TxyWnv/repo`, b thread `56ac6f97-9452-49e7-90c9-5f2365ec32dd` started at a ledger head `eecdf5bfec720106072bd1f276f9b472db7d0d1d` and read a code. With root review withheld, canonical a/b stayed ticket and derived-claimed “landed in root (awaiting target)”; outside still blocked by a. Release closed a/b/root with distinct summaries/evidence and made outside frontier. Three gates, nine phases. | held / expectation met |
| Failed refine | At `rc-global-refinement-dEIfDf/repo`, exact writer token `reconcile:root/root-refine-1` created x/y. Failure stopped writer before cleanup; x/y vanished, root restored to spec; baseline/friction/outside/foreign-claimed changed survived. No dependent launch. | held / expectation met |
| Sparse instructions / global writes | At `rc-global-sparse-xQRO94/repo`, worker and collector lacked docs/issues; attachments and canonical CLI read remained available; setup ready. Shipped common/role instructions and reference example executed. Handler ruling appeared immediately at owner; successor/setup read ruling two at unchanged predecessor HEAD. Forbidden tracker-code landing left source/target unchanged; code-only landing succeeded and retired worker. | held / expectation met |

Replay also held restart, linked-owner, both close-replay cuts, replacement, adoption and acceptance replay. Linked-owner delivered to its linked checkout, main lacked code but saw global results. Close replay launched no workers/gates. Adoption kept identities with one x/y launch each; acceptance replay kept collector HEAD unchanged and did not merge twice.

## Frictions and limits

Initial entry passed vault but could not open runtime: two remaining merge conflict blocks produced `Unexpected <<` at reconcile.ts:724. This was my incomplete mandatory merge resolution, not a product observation. Completed resolution in b2c82c1, rechecked markers, reran setup and the entire entry successfully. No unresolved surface friction observed. Merge handling required implementation inspection under the explicit setup assignment; the story encounter itself used only the provided public entry and output. No unit tests or repository checks run.

## Replayable checks

Run the entry above on this revision after setup:
- At root-review pause, accept b's base matching a's landed head and a code present, while canonical a/b are not done and outside not frontier.
- After release, accept a/b/root done, individual result/evidence preserved, outside frontier.
- On failed refinement, accept x/y absent, unrelated rows preserved, writer stopped before cleanup and zero dependent launches.
- In sparse mode, accept no worker tracker files or changes, canonical read/write successful, fresh successor ruling, refusal leaves both heads fixed and code-only integration retires its worker.

No browser, server or remote deployment was opened. Final owned-directory and writer-PID absence independently checked after replay.

