---
stage: "spec"
assignee: "agent"
author: "session:01a1fc85-32d0-7768-9382-3e18c7628a80"
claimed-by: "session:01a1fc85-32d0-7768-9382-3e18c7628a80"
priority: 2
---
Supervision (dispatch, integrate, retire, reconcile, pickup) runs inside bb, so a worker can be any bb provider (pi, codex, claude-code, an ACP agent such as Google Antigravity's `agy`) and the supervisor's tools reach any thread.

From @thread:thr_4vfx7djduu: "I don't think I'd ever be using supervision from pi directly anyway, so that seems like the more correct level". The occasion is Gemini 4 Neon through Antigravity: Google is strict about its subscription outside its own harness, so a worker should be `agy` itself as a bb ACP provider (`antigravity-acp` in `bb acp registry`), not pi calling Gemini. [pi-antigravity-bridge](https://pi.dev/packages/@estebanforge/pi-antigravity-bridge) was the alternative: it keeps workers pi, but layers pi's prompt and tools over agy's closed loop, and agy's own commands escape the guard.

## shape

The reconciler already runs as its own process that drives bb through its CLI, and worker reports come from bb's `turn/completed` events ([turn.ts](../../lib/thread/turn.ts)) whichever provider ran the turn; its status repair ([reconcile.ts](../../lib/reconcile/reconcile.ts) `repair(slug, c, "status", …)`) is a bb tell. Most of `lib/` stays. What's pi-shaped is the perimeter:

| today (pi) | in bb |
|---|---|
| tools in [extensions/supervision](../../extensions/supervision/index.ts) | `bb.agents.registerTool` in a `supervision` plugin in `~/dev/bb-plugins`, shelling to `bun` entry points here as the tracker plugin does with [desk.ts](../../lib/desk.ts) |
| `spawnBb` hardcodes `--provider pi` ([bb.ts](../../lib/thread/bb.ts)) | the routed execution names the bb provider |
| identity via `.wm/launch.env`, sourced by [bin/bb-pi](../../bin/bb-pi) | identity in the thread's `pluginMetadata`, delivered by `bb.providers.experimental_contributeEnv` for every provider |
| stance virtual models fall back mid-session ([stances](../../extensions/stances/index.ts)) | dispatch picks the first usable entry at spawn ([allocation.json](../../allocation.json), quota-axi); a `turn.failed` with category `rate-limit` replaces the worker with the next entry ([routing.md](../../routing.md): "Route model/effort at fresh-session boundaries") |
| guard's `tool_call` refusals ([guard](../../extensions/guard/index.ts)) | checked at the gate: integration re-runs the repository's hooks on the branch before it lands, so skipping them in a worker gains nothing. The pi refusals stay as a courtesy for pi workers |
| `PI_SESSION_ID` provenance in dispatch and the ledger | `BB_thr_4vfx7djduu_ID` |

Children: [[projects/mlegls-pi/issues/supervision-tools-as-bb-native-tools]], [[projects/mlegls-pi/issues/spawn-workers-on-any-bb-provider]], [[projects/mlegls-pi/issues/check-worker-rules-at-integration]], then the tracer [[projects/mlegls-pi/issues/antigravity-workers-in-reconcile]].

Out:
- The context fence ([context](../../extensions/context/index.ts)) stays pi-only; other providers compact on their own.
- A non-pi supervisor. Owned worker completion notices are dropped by a pi `input` handler ([[projects/mlegls-pi/issues/drop-reconciler-worker-notices-in-a-bb-plugin]]) because bb's dispatch hook skips parent system notices ([[projects/mlegls-pi/issues/installed-bb-bypasses-dispatch-hook-for-parent-system-notices]]); the supervisor stays pi until that's fixed upstream.
- Journal, recall, codemode and hashline stay pi tools; a non-pi worker has its own harness plus skills from `.agents/skills`.
- `from: "summary"` stays pi-only (it reads the parent's pi session file).

decisions:
- 2026-11-21: workers run agy as a bb ACP provider, not through pi-antigravity-bridge (@thread:thr_4vfx7djduu).
- 2026-11-21: worker rules are checked at integration, not by per-provider pre-tool hooks; the context fence is not ported (@thread:thr_4vfx7djduu).
