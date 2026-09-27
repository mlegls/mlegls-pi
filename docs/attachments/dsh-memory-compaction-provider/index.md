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
package, and the small session append patch. Shared Pi code and prompts are
unchanged. No recall index or persistent test harness was added.

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


Initial attempts (historical): one citation lacked `session-`; another carried a
`session-session-` prefix, and the follow-up native-fallback run had no checkpoint.
The fork created in that attempt had not been read. Commit `36319c6` normalized the
observed session-ID forms; the successful checkpoint and fork read are documented
below.


Screenshots show rendered Web states; archive input was synthetic user text, not a
mocked model output.

In an earlier session, the default workspace pointed outside the checkout. A user
asked “Remember: the relay switch is labeled copper-moth.” The model chose to create
`MEMORY.md` there via `tools.write`; that exact file was removed. Its source and
producer are established below. See the
[workspace ownership issue](../../issues/dsh-web-default-workspace-outside-home.md).

### Initial UI states

- [01](01-web-ready.png): new anonymous Web session.
- [02](02-first-turn.png): basic model response before the memory trial.
- [03](03-padded-session.png): fact-bearing archive session before compaction.
- [04](04-compacted-continuation.png): compacted conversation and continuation.
- [05](05-fork-session.png): fork created in the first attempt; recall was not verified then.

### Reproduction for the successful checkpoint


The original checkpoint ran at `3b9f6c2` and exposed the citation issue. This
reproduction command is the same local Web setup, but the completed rerun used
`36319c6` after adding/selecting the checkout-rooted workspace described below.

```sh
bun run --cwd dsh setup
PATH="$PWD/dsh/node_modules/.bin:$PATH" DSH_HOME="$PWD/dsh/.local/home" \
  dsh web --patch "$PWD/dsh/cordis.yml" --patch "$PWD/dsh/trial-memory.yml" \
  --no-open --host 127.0.0.1 --port 0
```

After the first idle Web launch initializes `workspace.json`, stop Web and add/select
the checkout workspace before any model turn. Restart Web with the command above and
verify its selection in the sidebar. From the repository root:

```sh
bun -e '
const p = "dsh/.local/home/storages/workspace.json";
const x = JSON.parse(await Bun.file(p).text());
const id = "01b01687-61e7-437c-841e-793449c513ad";
const now = new Date().toISOString();
x.global.workspaceIds = [...new Set([...x.global.workspaceIds, id])];
x.global.defaultWorkspaceId = id;
x.tables.workspaces[id] ??= { path: process.cwd(), title: "dsh-memory-compaction-provider-verify", sessionIds: [], createdAt: now, updatedAt: now };
x.tables.workspaces[id].path = process.cwd();
x.tables.workspaces[id].title = "dsh-memory-compaction-provider-verify";
x.tables.workspaces[id].updatedAt = now;
await Bun.write(p, JSON.stringify(x, null, 2) + "\n");
'
```


The original server was anonymous/token-authenticated and used isolated
`dsh/.local/home`, but selected `/Users/mlegls/Documents/deepseek-harness/default-workspace`
outside the checkout. This historical target was not reused for the rerun. The exact
`MEMORY.md` created in that workspace was removed; see the attribution above.

## Successful fresh rerun on `36319c6`

The handoff above predates the retry. Before any model turn, I added workspace
`01b01687-61e7-437c-841e-793449c513ad` to `dsh/.local/home/storages/workspace.json`
and selected it as default. Its path is this checkout; Web showed this workspace
selected, and the session header records the same checkout as `cwd`.

In `session-e3b7f2c6-2ad4-4cc9-b061-2ae60818a72a`, synthetic user event 8 gave the
fact `amber-tern-731`; event 24 supplied 192,699 characters of synthetic archive
padding. The real provider appended `memory/checkpoint` event 35: register
`compaction-om-v10`, operation `append`, checkpoint sequence 33, tail through event
25. Its source citation is now correctly framed as
`session-e3b7f2c6-2ad4-4cc9-b061-2ae60818a72a:8`. The next answer preserved the
fact and tail. A same-session `run_code` call to
`tools.session_event_read({session_id: "session-e3b7f2c6-2ad4-4cc9-b061-2ae60818a72a", seq: 8})`
returned the original event; the assistant reproduced its text exactly.

I branched from the latest parent answer. Fork
`session-0e3383c3-6221-4ecc-9832-6f813334ec6b` has `parentSession` set to the
source session, `isSeeded: true`, the inherited `memory/checkpoint` event, and a
checkout-rooted `cwd`. From that fork, the same `session_event_read` call against
the source citation returned the original event verbatim; the assistant reproduced
the same text. Both reads used the public `session-` ID and passed. This holds the
citation normalization fix and fork recall requirement.

### `MEMORY.md` attribution

The earlier file was not written by a default memory contributor or by
`dsh/memory/index.ts`. In the old session
`session-8930f63a-f761-4d68-acad-ae99fdd34eee`, the user said
“Remember: the relay switch is labeled copper-moth.” The model chose to persist it:
its `run_code` dispatched `tools.write` for `MEMORY.md` (event 25), then read it back
(event 27). The configured Hashline preset exposes ordinary file tools; the memory
provider only generates a checkpoint and appends `memory/checkpoint` to the session.
There is no separate automatic contributor to disable, and no provider file-write
bug. `dsh/trial-memory.yml` therefore retains the provider needed for this trial.
The prior “unrequested” description refers to the model-chosen file persistence and
location, not an unsolicited memory contribution.

The checkout-owned workspace workaround resolved the setup hazard for this rerun;
the old default workspace remains external and was not used. Its ownership issue is
still documented separately. Screenshots show the rendered compacted continuation,
parent recall, and fork recall ([06](06-owned-workspace-compacted.png),
[08](08-parent-verbatim-read.png), [07](07-fork-verbatim-read.png)).

The preceding reproduction and handoff describe the earlier attempt only; their
workspace and fork-read limitations were resolved by the rerun above.

## Visual review of the `36319c6` rerun

Reviewed 06, 08 and 07 (1200×2029 full-page captures, dark theme, en locale)
against the ticket, together with the durable session logs behind them. The chat
UI does not show the checkpoint or the collapsed `run_code` calls, so the logs are
what establish compaction and the tool read; the screenshots establish what the
Web user sees. Log excerpt: [rerun-log.json](rerun-log.json), decompressed from
the verify worktree's `dsh/.local/home` sessions (synthetic data, no credentials).

| Claim | Outcome | Evidence |
| --- | --- | --- |
| Long session in `dsh web` compacts through the memory provider | held | Parent events 31–35: `compaction/summary`, checkpoint `user/message` 33 with `surfaceOp: replace 8..24`, ignorable `memory/checkpoint` 35 citing `session-e3b7f2c6…:8`. [06](06-owned-workspace-compacted.png) shows the context meter at 0% after the padded turn. |
| Continuation carries checkpoint and verbatim tail | held | Model surface after compaction is system 7, checkpoint 33, unchanged tail assistant 25, then user 37. Continuation 39 answered `amber-tern-731` / east sensor active (fact exists only in replaced event 8) with 1,224 + 2,816 cached input tokens; visible in [06](06-owned-workspace-compacted.png). |
| Cited original turn recalled verbatim (parent) | held | Dispatch 51 `session_event_read({session_id: "session-e3b7f2c6…", seq: 8})`, `isError: false`, result contains the exact original; answer 57 contains it verbatim; visible in [08](08-parent-verbatim-read.png). |
| Recall from a forked session | held | Fork `session-0e3383c3…` header has `parentSession` = parent, `isSeeded: true`; all 60 parent events are byte-identical in the fork prefix (seed end 60), including `memory/checkpoint` 35. Fork dispatch 73 read the parent citation without error; answer 79 is verbatim; visible in [07](07-fork-verbatim-read.png). |

Nonblocking observations (dsh Web / trial configuration, not this provider):

- 06: nothing in the chat marks the compaction; the padded message is still
  rendered in full and only the context meter shows 0%. A Web user can't tell a
  checkpoint happened or what it said. Smallest fix belongs to dsh Web: a
  compaction divider linking to the checkpoint.
- 07: the header title is truncated to the same text as the parent, so the fork
  is only identifiable by the highlighted sidebar row, whose title is clipped on
  the left (`ɪnd east sensor details`) while hover actions are shown.
- 07/08: the `run_code` call is collapsed under “Took 31s”; the screenshot alone
  cannot distinguish a tool read from recitation (the log does).
- With the trial `thresholdRatio: 0.001`, every later step retried compaction and
  the native writer rejected it (`summary is not smaller than the shadowed
  content`, four times across parent and fork; see `laterRejectedCompactions`).
  Expected for the trial overlay, but each rejection spends a model call.

Overflow (`agent/request-error`) and provider-filter fallback remain unforced, as
recorded under Checks and limits; the ticket's done-when does not require them.
