# Life session attachment: implementation first use

Runtime revision: 3d726c47. Reproducible setup and guide: 6b1c9880,
[scripts/life-playground.ts](../../../scripts/life-playground.ts) and
[life/README.md](../../../extensions/context/life/README.md).
This is the implementer's first-use log; independent driving follows.

## Setup

Installed pi 1.5.0 on Bun, real Anthropic Haiku 4.5 calls using the host's existing pi credential.
No credential values were copied. Temporary git projects and separate records stores:

- Terminal/RPC pair: /tmp/pi-life-FZxF8X, life /pi-life-FZxF8X.
- BB pair: /tmp/pi-life-vqPepP, environment env_p2idfa8d2h, life /pi-life-vqPepP.
  Threads thr_8kd2h3jbct and thr_5zxsz3xuh6; each owns a distinct persisted pi session.

Generate a new target from the checkout under test:

```sh
bun scripts/life-playground.ts prepare
# Run in two terminals, substituting the returned root:
bun scripts/life-playground.ts start <root> one
bun scripts/life-playground.ts start <root> two
```

The launcher supports RPC through extra `--mode rpc` arguments. `prepare-bb` instead
prepares project discovery, store selection, explicit startup PI_LIFE and directory-specific
trust for two real BB Pi threads. Start them on its returned directory with ordinary prompts.
The helper's generated files, rather than any existing worktree-local state, reproduce setup.
Notes are enabled beside life. tailBytes is 800; raise it for catch_up trials that should
retain the original view through several tool calls.

## Observed

- Gave an unattached terminal session the reply FIRST HISTORY 712, then attached it with /life.
  Another attached process found 712 in the copied life records. The first process's next run
  described the other session's completed search and hold.
- hold wrote reading history. A shell child reported PI_LIFE unset.
- Two terminal processes overlapped a sleep run and a completed sibling reply. With the small
  tail budget, the first process advanced its view during the run, so its later catch_up found
  nothing beyond that updated view.
- Across this terminal first use, 47 copied messages had contiguous positions and 16 saved-view
  records had strictly increasing upTo values. Those intermediate views were written before
  the runs' final appends. Tool calls completed without a provider call/result-pair error.
- The note tool saved one project note while attached. /life off and /memory completed through
  direct pi RPC.
- Two actual BB Pi sessions attached using startup PI_LIFE. Their normal runs completed and
  subsequent actual hold calls wrote reading history and watching elsewhere. The shared present
  showed both titled threads open with those holds.
- In a subsequent BB overlap, both appeared Working with their holds. While one slept for
  twelve seconds, the other used catch_up(thread) and reported its unfinished sleep/catch-up
  request. After sleeping, the first used catch_up() and quoted the sibling's newly committed
  lines with thr_5zxsz3xuh6 as their place.

## BB setup friction

The first untrusted BB workspace skipped project extensions. The setup helper now saves trust
only for its owned temporary directory in prepare-bb, and untrust removes that decision.

The installed BB provider still has
[handled-input settlement](../../issues/bb-pi-handled-input-leaves-thread-active.md) and
[agent-message slash dispatch](../../issues/bb-pi-tell-slash-command-reaches-model.md) issues.
New observations were added through the tracker. A handled /life command saved in Pi but left
BB waiting for a model run that would never start; an agent-authored tell wrapped the slash
text, making it a model prompt instead. Startup PI_LIFE avoided those bridge paths.

A fresh pi session with only setup/custom entries has no session file until its first user
or assistant message. Stopping a fresh BB thread immediately after a handled /life therefore
also discarded that as-yet-unwritten attachment. The BB recipe starts ordinary runs with an
explicit startup name, so those attachment entries are persisted with their first messages.

## Checks and next drive

bun run typecheck passed. Existing affected tests: 18 passed across mechanism, build, log,
tree and elide; no new tests were added. The existing default-mechanism assertion now expects
OM, and the mechanism fixtures use life rather than optmem.

The independent driver should cover the full ticket journey, especially resume/fork, model
changes, explicit named delegation, newer-position zoom/date, summary waiting across processes
and append-before-boundary with complete tool groups. The launcher and usage guide supply that
starting surface. No browser or desktop surface was involved.
