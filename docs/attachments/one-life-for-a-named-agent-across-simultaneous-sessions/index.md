# Shared life: assembled first use

Tested revision: `e6e7af9944d5f93ebf513a95c68d4819c1f07378`. This is the parent implementation pass after its four children landed. The runtime join, rename, prompt and first-use launcher were already present; no additional runtime repair was needed. This encounter exercised shared recall, interrupted-history recovery, environment consumption and detach. Independent acceptance follows this implementation handoff.

Nonvisual CLI/library journey; no screenshots.

## Setup and replay

Required environment: local pi processes sharing one temporary records store on this machine. No remote deployment, Hermes import or Concept Engineering trial is involved. `memory.default` and the maintainer's settings are unchanged.

Prepared target: `/tmp/pi-life-EtM8pd`, created by this worker with `bun scripts/life-playground.ts prepare`. Machine-wide life `/pi-life-EtM8pd`; store `store/records.db`; sessions under `sessions/{one,two}/`. Existing installed pi Anthropic authentication, Haiku 4.5; no credential files copied. Notes were enabled by the launcher. For this encounter only, the generated `.pi/settings.json` used `tailBytes: 1000000` so an interrupted run would remain unappended until restart. Readiness was observed through successful `get_state` responses and completed live requests from both processes.

From the checkout being verified, prepare a fresh owned target and start two sessions:

```sh
bun scripts/life-playground.ts prepare
bun scripts/life-playground.ts start <root-from-prepare> one --mode rpc
bun scripts/life-playground.ts start <root-from-prepare> two --mode rpc
```

The same commands without `--mode rpc` open the terminal interface. [Life's guide](../../../extensions/context/life/README.md) covers commands, tools, settings and the actual-bb setup. The prepared target above retains its transcripts for inspection, but a replay needs only the committed launcher and a newly prepared target. After replay, stop only the processes that replay launched.

## Encounter

Session one was `01a1cdfd-5629-75a9-a3f6-33d956c82716`; session two was `01a1cdfd-5620-77a1-95e4-672adfd86608`.

| Action | Observed result |
| --- | --- |
| One received `Remember COPPER-527 as the code chosen in this place. Call hold with text copper parcel, then reply COPPER-527 only.` | Hold succeeded; final reply `COPPER-527`. |
| Two received `What code did I choose in the other place? Answer the code only, no tools.` | `COPPER-527`, although two's own prompt did not contain it. |
| One received `Remember INTERRUPTED-681 as the interrupted parcel code. Call hold with text interrupted parcel first, then reply with this code only.` Its process was killed by exact PID immediately after `tool_execution_end` for hold, before a final reply. | `lifeLog(name).read()` still contained six messages and none containing `INTERRUPTED-681`. This established the interruption preceded run append. |
| Restarted slot one with `--no-life-env`, allowing `--continue` to resume its own session. Requested `get_state` to wait for startup completion. | Same session id; the shared log now contained nine messages. Position 6 was the interrupted user message, source `entry:01a1cdfd-5629-75a9-a3f6-33d956c82716/dd290fcd#0`, credited to that session. The other two recovered messages were its hold call and result. |
| Two then received `What was the interrupted parcel code from the other place? Answer the code only, no tools.` | `INTERRUPTED-681`. Recovery was visible to another manifestation at its next run, without a completed response in one. |
| In resumed one, RPC bash ran `printf 'PI_LIFE=<%s>\n' "$PI_LIFE"`. | Exit 0; `PI_LIFE=<>`. |
| Submitted `/life off`, then `/memory` in resumed one. | Notifications: `Life: off`; `Memory: om (compaction) + elide (context) + notes; off: journal, life`. |

The recorded store reads use the real `lifeLog` API against this isolated store; they join the resumed session id to the exact copied source ref. They are separate from the model's recall responses.

## Existing coverage of the assembled contract

The children supplied the rest of first use and their independent drive/review records:

- [Copied log](../life-log-copies-and-orders-runs/index.md): concurrent whole-run ordering, source deduplication, fork ancestry, historical models, self/work classification, project/machine names and reading after source deletion.
- [Presence](../life-present-working-threads-and-holds/index.md): batched real bb metadata, working/open/archived places, holds visible across processes, clear/detach, pid fallback and unfinished sibling reads.
- [Shared compactor](../life-compacts-one-shared-tree/index.md): one lease winner, polling while another process waits in `idle`, first-record-wins loading, expired leases, cancellation and the turn's model/prompt/tools/cache marking.
- [Session/context join](../life-session-attachment-and-run-context/index.md): two actual bb sessions, overlap, catch_up, newer zoom/date, notes, model change, resume/fork, detachment, long-run prefix commits and its review re-drive after the summary-context repair. The review's final head is included in this pass's base.

No additional behavioral gap was found in this implementation pass. The parent driver owns fresh acceptance of the assembled feature; the older packets remain evidence of their recorded encounters, including their stated limits.

## Regression checks and cleanup

`bun test extensions/context/life extensions/context/mechanism.test.ts extensions/context/elide.test.ts extensions/context/notes.test.ts lib/records/cursor.test.ts`: 22 passed, zero failed, 11,008 assertions. `bun run typecheck`: passed. No tests were added or edited. There is no `test:affected` task and no configured executable commit hook.

All three launched pi processes ended: the interrupted process was killed by its exact owned PID, and the two remaining processes exited 0 after closing stdin. No bb threads, servers, tunnels, containers or browser sessions were created. The generated temporary directory remains as data only; no runtime is left running.
