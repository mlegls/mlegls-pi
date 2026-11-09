# Independent first-use drive

Revision: 22a49740043b0ea72b858337e44f687d4a8dd17d.

## Predictions before opening the product

- Running the supplied CLI will initialize a fresh, owned temporary backend store without credentials and report OM as the active compaction owner.
- One compaction through the registered mechanism will render stored OM memory with an identifiable record id.
- Resolving that rendered id through recall will expose its source transcript entry.
- Moving between a transcript branch and its fork will show only memories citing ancestors of the selected tip; noninteractive reads can retain the complete ledger.
- The prepared journey will clean up its temporary project/store. No browser or server is needed.

Setup handoff: keyless backend library journey; no authentication; seeded transcript entries and deterministic OM observation/reflection outputs; entry point `bun docs/attachments/memory-as-a-log-with-pluggable-projections/drive.ts`. The entry point owns allocation/removal of its fresh temporary target. Readiness will be established by successful initialization and active OM ownership in its output.

## Encounter and outcomes

Ran the supplied command once; exit 0. No implementation, tests or fixtures were read. This is a backend library encounter through the supplied setup entry point, with seeded model outputs; no live model or outer pi event loop was exercised.

| Story / prediction | Observed result | Outcome |
|---|---|---|
| Owned keyless store initializes | STORE reported isolated=true, four OM records, zero transcript OM custom entries | met |
| Registered compaction renders bounded OM | MAIN reported renderer=om, budget=512, summaryTokens=263 and renderedId=bbbbbbbbbbb1 | met |
| Rendered memory resolves to original entries | MAIN reported recallStatus=ok and sourceEntryIds=[a1,a2] | met |
| Sibling branch hides nonancestor memory | SIBLING reported rendered=false. Recall returned a raw global reflection record, including anchor entry:join-parent/a2 and reflects om:aaaaaaaaaaa1, rather than expanded source turns | met |
| Fork inherits only through its fork point | FORK inherited aaaaaaaaaaa1 and bbbbbbbbbbb1, excluded aaaaaaaaaaa2, resolved source ids a1,a2 and reported inherited observation active | met |

The sibling recall's raw-record fallback is consistent with the prepared public journey's documented global lookup; it does not establish branch-scoped source expansion. This distinction was visible in the output and caused no failure of the rendering prediction.

## Replayable checks

Run `bun docs/attachments/memory-as-a-log-with-pluggable-projections/drive.ts` at the tested revision. Accept MAIN only with OM ownership, a summary at or below 512 estimated tokens, a rendered id and successful recall to a1/a2. Accept SIBLING only with no rendered memory and no expanded source transcript. Accept FORK only with both inherited ids, exclusion of the later id, source recall a1/a2 and an active inherited observation. Accept STORE only when isolated and backed by four OM rows rather than transcript OM custom entries.

## Frictions and limits

No unresolved product or tooling friction encountered. The CLI summarizes API observations; no rendered UI journey occurred. The setup contract owns temporary allocation and removal; no persistent deployment, server, browser or external resource was started by this drive. Historical upstream replay and child delivery results remain in the index; this pass did not rerun unit tests or install upstream dependencies.

