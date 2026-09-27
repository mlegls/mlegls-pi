# Memory provider first use

Implementation self-check on `4577dc2` (starting ref `5909d99`). Fresh supervised
verification remains. These are backend encounters in a real `dsh web` process;
no rendered conversation claim or visual verdict is made.

## Required and prepared environment

Required: local dsh Web with a configured model; no Cloud deployment.
Prepared: worker-owned `dsh-memory-compaction-provider` checkout, pinned npm dsh
0.1.7-rc.2, isolated `dsh/.local/home`, local anonymous Web identity. Model calls
used `deepseek-official / deepseek-flash` and environment credential
`DEEPSEEK_API_KEY`; no credential value is recorded. No inherited user profile or
Cloud selector was used. `bun run --cwd dsh setup` completed and applied the
session append patch.

Workspace **Memory provider first use** points to this checkout. The final parent
is `f4c2a4f7-381e-4f08-8225-7e2a3db71c2f`; its usable fork is
`3609be9b-8b4d-4795-8f44-97a995166671`. Both were resumed from persisted logs and
attached through `ctx.workspaceRegistry`, not by changing another checkout.
Earlier failed diagnostic sessions remain ungrouped; use these two IDs.

From this checkout:

```sh
bun run --cwd dsh setup
PATH="$PWD/dsh/node_modules/.bin:$PATH" DSH_HOME="$PWD/dsh/.local/home" \
  dsh web --patch "$PWD/dsh/cordis.yml" --patch "$PWD/dsh/.local/provider.yml" \
  --no-open --host 127.0.0.1 --port 0
```

The ignored provider patch is prepared. Its non-secret contents are:

```yaml
- id: llm-deepseek
  name: '@deepseek-ai/dsh-llm-deepseek-api-key'
  config:
    apiKeyEnv: DEEPSEEK_API_KEY
- id: agent-default-model
  config:
    provider: deepseek-official
    model: deepseek-flash
- id: session-log-deepseek
  disabled: true
- id: plugin-package-inventory-deepseek
  disabled: true
- id: memory
  config:
    thresholdRatio: 0.02
    retainTokens: 1200
    headroomTokens: 8192
    maxTokens: 8192
    compactionRetries: 0
```

The lower pressure threshold is trial configuration, not the committed default.
The two optional contributors are disabled using the existing
[DeepSeek preparation workaround](../../issues/dsh-web-deepseek-extension-preparation-fails.md).
All trial Web processes and the owned browser CLI were stopped after preparation.
The home, workspace and sessions remain available for the verifier.

## Encounter and observations

A temporary ignored host plugin created an agent with the hashline preset. After
one real READY turn established its system head, it appended a synthetic
calibration archive (~195k characters), then sent ordinary followups. The archive
was recorded input, not mocked model output. The unchanged checkpoint prompt ran
against the actual DeepSeek model through `ctx.llm.stream`.

The first candidate did not shrink its selected prefix; the native writer
rejected it and kept the surface. The next pressure-triggered checkpoint landed.
The continuation answered with `violet-lantern-731` and `east sensor`.

| Claim | Outcome | Evidence |
| --- | --- | --- |
| Long session compacts through memory | held | [metrics.json](metrics.json): `compaction-om-v10`, four replaced nodes, 49,047 estimated shadowed tokens, ignorable memory record. |
| Continuation carries checkpoint and verbatim tail | held | Replayed the log immediately before and after the successful compaction: checkpoint 34 is visible; tail nodes 25 and 26 and their projected messages are deeply equal. Continuation text is in metrics. |
| Cited original can be recalled verbatim | held | `run_code` called stock `session_event_read` for original user event 18. Its returned event JSON was hashed inside the program; all 195,671 serialized characters match the original event hash. |
| Recall works from a fork | held | A new fork inherited the exact parent prefix. Its actual model called `run_code` and `session_event_read`, then reported the identical hash and original sentence: [fork-recall.json](fork-recall.json). |
| Memory survives persistence and lineage | held | Both final sessions resumed after server restart, with ignorable memory records and visible checkpoints: [replay.json](replay.json). |

The fork model first inspected the string framing, then tried a static import
(which PTC rejected), then corrected it to dynamic import and completed. The
successful original-event SHA-256 was
`c8e0d9e6f594914f5988aca98aa745fb3043d444009b9a066a6cb9238da2db46`.
The packet deliberately omits provider reasoning, credential values and the
repetitive full archive.

To repeat recall in either prepared session, ask the model to run:

```ts
const raw = await tools.session_event_read({
  session_id: "f4c2a4f7-381e-4f08-8225-7e2a3db71c2f", seq: 18
});
console.log(raw);
```

For a fresh compaction encounter, use the prepared low-threshold patch, establish
a normal turn, add enough conversation history to exceed pressure, then continue.
The implementation diagnostics (`dsh/.local/trial.js`, `fork.js`, `recall.js`) are
scratch, not permanent acceptance tests or required launch plugins. Prefer normal
model turns: direct host PTC dispatch needs the
[agent turn lifecycle](../../issues/dsh-diagnostic-tools-need-agent-turn-lifecycle.md).

## Checks and limits

- Existing memory regressions: 8 passed (`extensions/memory`, `lib/memory.test.ts`).
- Focused strict TypeScript check of `dsh/memory/index.ts`: passed.
- `git diff --check`: passed.
- Root typecheck remains blocked by unchanged Obsidian tracker ambient types:
  [existing owner](../../issues/root-typecheck-obsidian-environment.md).
- Tracker structural check reported existing done-dependency links; this ticket's
  resolved hashline blocker was removed. Final semantic lint completed with a
  `completed` advisory; the ticket stays open for fresh supervised verification.
- No new permanent acceptance tests. Overflow and provider-filter fallback are
  implemented through the inherited native hooks, but were not forced in this
  first-use encounter. Rewrites at the 12k memory budget were not exercised.
- `/compact` remains native. The shared prompt and Pi extension are unchanged.
- Dsh citation validation now separates source provenance from prefix coverage:
  [decision and remaining Pi question](../../issues/memory-checkpoint-cites-retained-tail.md).
- The pinned session package needs the
  [explicit ignorable append patch](../../issues/dsh-session-append-ignorable.md).
- Bash board reads worked; acknowledgments were unavailable through that adapter:
  [existing owner](../../issues/board-acks-are-a-host-runtime-event.md).

Runtime cost: one 125-line provider, nine overlay lines, one stock query-tool

## Fresh supervised encounter

Tested revision `3b9f6c2`. The required deployment was local dsh Web with model
credentials; this run used a new worker-owned checkout target at
`127.0.0.1:50348`, anonymous token-authenticated Web, and `dsh/.local/home`.
The inherited prepared home, provider patch and parent/fork sessions described
above were absent in this worktree. I completed `bun run --cwd dsh setup`, rebuilt
the provider, recreated its ignored local provider configuration, and waited for
`dsh web` readiness. The Web UI opened successfully; a fresh one-turn interaction
returned `READY` from the configured default model (see [ready UI](01-web-ready.png)
and [completed turn](02-first-turn.png)). The observed UI model was
`DeepSeek-V41-Flash`; the missing prepared DeepSeek trial sessions could not be
assumed available or substituted.

This only establishes basic Web/model readiness, not the ticket's acceptance
journey. The persisted calibration archive, lineage sessions and trial workspace
weren't present, and this first-use run did not seed a replacement long-history
session or drive compaction/fork recall. Consequently each required story remains
**unobservable** in the fresh encounter. No screenshot is represented as evidence
of compaction. The temporary Web process and browser CLI session were stopped.
package, and the small session append patch. Shared Pi code and prompts are
unchanged. No recall index or persistent test harness was added.

## Follow-up supervised encounter

The low-threshold overlay is committed as `dsh/trial-memory.yml`; it sets
`thresholdRatio: 0.001` and `retainTokens: 64` for this trial only. In the owned
local Web session `Field notebook amber tern facts` (session
`session-a44dfe96-c94f-408c-9084-40954b2fbb4d`), the initial distinct facts and two
synthetic padding messages were followed by a successful provider checkpoint at
seq 122. It used register `compaction-om-v10`, append operation, cited source seq 8,
covered 26 source nodes, and retained tail through assistant event 111. The
continuation showed the checkpoint facts and preserved both archive histories;
UI shows context usage returning from 2% to 0% ([compacted UI](04-compacted-continuation.png)).
A later same-session request used `run_code` and `tools.session_event_read` with no
`session_id` and returned the original user event text verbatim. Passing the
checkpoint's unprefixed ID explicitly failed as outside the caller workspace.

A separate fresh session after the first attempted ID fix emitted citations with a
doubled `session-session-` prefix. This prompted a normalization change in
`dsh/memory/index.ts` to handle both observed `session.id` shapes. The subsequent
fresh session compacted via native fallback and did not append a memory checkpoint,
so the normalized citation change is not yet re-driven. The ticket's citation
claim is therefore not held for the repaired code. A fork was created from the
fresh session; citation recall from that fork was not completed.

Screenshots show the rendered Web journey; archive input is synthetic user text,
not a mocked model output. The model also wrote one unrequested workspace memory
file during a later session. The workspace pointed outside the checkout despite
isolated `DSH_HOME`; that exact file was removed. See

### UI states

- [01](01-web-ready.png): new anonymous Web session.
- [02](02-first-turn.png): basic model response before the memory trial.
- [03](03-padded-session.png): fact-bearing archive session before compaction.
- [04](04-compacted-continuation.png): compacted conversation and continuation.
- [05](05-fork-session.png): forked conversation surface; recall from this fork remains unverified.
[workspace ownership issue](../../issues/dsh-web-default-workspace-outside-home.md).

### Reproduction for the successful checkpoint

The checkpoint encounter ran at revision `3b9f6c2` with the overlay below; the
later ID-framing repair is commit `36319c6` and has not yet passed a new
checkpoint-and-recall journey.

```sh
bun run --cwd dsh setup
PATH="$PWD/dsh/node_modules/.bin:$PATH" DSH_HOME="$PWD/dsh/.local/home" \
  dsh web --patch "$PWD/dsh/cordis.yml" --patch "$PWD/dsh/trial-memory.yml" \
  --no-open --host 127.0.0.1 --port 0
```

This local Web server was worker-owned (`127.0.0.1:52301` for the final trial
process), anonymous/token-authenticated, and stopped after the encounter. The
session store was isolated under `dsh/.local/home`; however, its selected workspace
resolved to `/Users/mlegls/Documents/deepseek-harness/default-workspace`, outside
the checkout. The one file created there by the model was removed. Do not reuse this
workspace as an owned test target until the Web workspace ownership issue is
resolved. The separate screenshot of the fork records session creation, not a
successful cross-session read.
