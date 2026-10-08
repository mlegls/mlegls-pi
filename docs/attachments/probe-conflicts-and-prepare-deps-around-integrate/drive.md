# Independent drive, 2026-10-08

Tested revision: `6e554688cb898865b01132f5eaea10b8869ff4b1`.

## Predictions before first use

Persona: maintainer landing a reviewed child branch. Surface: documented backend fixture CLI, not rendered UI. Setup: this worktree, fixture-owned temporary Git checkouts, no authentication; seeded main/child branches and completed review. Run documented `mise run setup` before the fixture commands. No inherited deployment selectors are required.

- Conflict: running `fixture.ts conflict` should return a child message naming `conflict.txt` and the target commit subject, while preserving both heads and not running setup or gate.
- Dependency change: running `fixture.ts deps` should successfully land and record `deps` before `gate`.
- Fallback: running `fixture.ts setup` should successfully land and record `setup` before `gate` when no deps task is declared.
- Unchanged inputs: running `fixture.ts unchanged` should land with only `gate`, without unnecessary dependency preparation.

## Encounter

`mise run setup` completed successfully in this worktree (both frozen dependency installations were already current). The four documented fixture commands ran sequentially and exited successfully in 30 seconds. No implementation, tests or fixture source inspected.

| Journey | Observed result | Expectation |
| --- | --- | --- |
| `conflict` | Child message named `conflict.txt` and `0982a8b Target conflict subject`; target and child before/after SHAs each matched, order was empty, `done` was false. | Met |
| `deps` | Target head changed, child checkout was retired (`childAfter: null`), `done: true`, order exactly `deps`, `gate`. | Met |
| `setup` | Landing completed with order exactly `setup`, `gate`. | Met |
| `unchanged` | Landing completed with order exactly `gate`. | Met |

## Replayable checks

From the tested revision, run `mise run setup`, then `bun docs/attachments/probe-conflicts-and-prepare-deps-around-integrate/fixture.ts <mode>` for each mode above. Accept conflict only if the RESULT message names the path and target subject, both heads are unchanged, order is empty and done is false. Accept deps/fallback only if done is true and the matching preparation step precedes gate. Accept unchanged only if done is true and order contains gate alone.

## Frictions and limits

No product friction encountered. Fixture CLI provides the actual child message and task order as structured output, so no browser or screenshots were needed. Coverage is the four documented seeded local Git journeys, not a live worker/model session or an exhaustive manifest/lockfile matrix. The obsolete resume/decompose paragraph is outside the contract. Both processes finished; fixture-owned targets are documented as automatically removed. No servers or external resources were started.

