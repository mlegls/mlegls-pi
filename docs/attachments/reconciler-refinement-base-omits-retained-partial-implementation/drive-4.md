# Owner replay after collector merge

Tested revision: `7fd5ba32`. Surface: local reconciler replay as owner in fake BB, no credentials. Each run uses disposable Git, tracker, ledger and BB state, with `$HOME/dev/mmon/concept` supplying historical Git objects read-only.

## Predictions before replay

- Strand tags: after the tracker drops the observed `blocked-by` edge, the implementer starts at `2108745e1`, containing `8bfc65b8b`, with no owner exception.
- Startup refinement: the refiner starts on a clean base containing `f042591bf` and the superseded attempt's declared checkpoint `e7d54e22e`, with no owner exception.
- 5,000-card startup: the owner sees one exception identifying base `87bb5753b`, checkpoint `0afc596da` and four conflicting files; no worker starts. On retry with `3ede6f0a7`, the worker starts without a second exception.
- Card-to-Problem: with the prerequisite supplied as a tracker edge, the owner sees one exception identifying base `022f159e4`, source `00dca0acb` and four files including the Problem union; no worker starts. Answering to proceed without the prerequisite starts the worker from `022f159e4` without a second exception.

## Observed

`mise run setup` succeeded. The [three replay commands](index.md) completed in 1m 36s, with no live services or rendered UI.

| Prediction | Result | Replayable check |
| --- | --- | --- |
| Strand tags | Met: one implementer at `2108745e1`, `containsRequirement: true`; no exception reported. | Run the default replay; require the strand-tags result to report an implement spawn at that head with the prerequisite present after edge removal. |
| Startup refinement | Met: replay reported a refine launch at merge head `6ad8b41d`, `containsRequirement: true`; no exception reported. `spawns: 2` is the reported total across the attempt and refinement, rather than a count of refiners. | Run the default replay; require a refine launch with the declared `e7d54e22e` checkpoint present. |
| 5,000-card startup | Met: zero spawns at the conflict; owner exception named `87bb5753b`, `refs/heads/retained-collector` at `0afc596da`, and four files. Retry started one implementer at `3ede6f0a7` with the requirement and `ownerExceptions: 1`. | Run `5000-card-startup retry`; require the exception before launch, four paths, then one spawn and an unchanged exception count after retry. |
| Card-to-Problem | Met: zero spawns at the conflict; owner exception named `022f159e4`, the landing checkout HEAD at `00dca0acb` and four files including `packages/web/convex/lib/quiz_problems.ts`. The owner's answer started one implementer at `022f159e4`, `containsRequirement: false`, `ownerExceptions: 1`. | Run `card-to-problem answer`; require four paths and no pre-answer spawn, then one spawn on the old base and an unchanged exception count. |

Friction: the startup-refinement output gives a cumulative `spawns` count next to `phase: refine`; the count alone does not distinguish the old implementer from the new refiner. The 5,000-card case stops before the separate browser checkpoint, as specified.

## Review replay

All four predictions held on `20beca54`. The replay now prints worker titles: strand tags spawned one implementer at `2108745e1`; startup refinement spawned `root/startup-refinement-implement-1` followed by `root/startup-refinement-refine-2`, ending at `6ad8b41d` with the checkpoint present. Both conflicts listed four paths and `spawnedWorkers: []`. The 5,000-card retry started at `3ede6f0a7`. An answer targeting the root instead of the Card-to-Problem node left its exception pending and spawned nothing; answering on the node then started its implementer at `022f159e4`. Both resolutions ended with `ownerExceptions: 1`.

The three commands took 1m 28s. Existing launch-recovery, landing, resume, stop, retry, exceptions and refinement checks passed (20 tests total).

