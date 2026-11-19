# Reconciler launch-base replay

[Independent drive after the collector merge](drive-4.md)

Run the reconciler against pinned Concept history:

```sh
replay=docs/attachments/reconciler-refinement-base-omits-retained-partial-implementation/replay.ts
bun "$replay" "$HOME/dev/mmon/concept"
bun "$replay" "$HOME/dev/mmon/concept" 5000-card-startup retry
bun "$replay" "$HOME/dev/mmon/concept" card-to-problem answer
```

The driver is the run owner in a fake BB, with no credentials or model. Each case creates and removes its own temporary Git repository, tracker, ledger and threads. The Concept checkout supplies Git objects read-only; there is no Concept deployment or application setup. Observe worker spawns, the resulting HEAD's ancestry, and the owner's exception in the replay output.

| Case | Observed at phase start |
| --- | --- |
| Strand tags | After the tracker edge disappeared, the implementer fast-forwarded from `9b20c1938` to the recorded source checkout's `2108745e1`, containing `8bfc65b8b`. |
| Startup refinement | The superseded implementer's `commit: e7d54e22e` in its respec handoff reached the new refiner in a clean merge with `f042591bf`. |
| 5,000-card startup | No spawn; one owner exception for `87bb5753b` taking retained collector `0afc596da`, naming four files. `retry` with the historical hand merge `3ede6f0a7` started the phase without another exception. |
| Card-to-Problem | No spawn; one owner exception for `022f159e4` taking `00dca0acb` (containing `76d691f98`), naming four files including `packages/web/convex/lib/quiz_problems.ts`. `answer` started from `022f159e4` without the requirement or another exception. |

The two landed-prerequisite cases seed the `blocked-by` link, let the walker see it, then publish a landing in a different run's ledger and remove the tracker edge. Card-to-Problem pins the link its historical ticket only named in prose. The 5,000-card case starts with the collector checkpoint already recorded; it stops before the separate `5b3c50dcf` browser checkpoint.
