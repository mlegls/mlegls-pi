# Antigravity reconcile tracer

Use a disposable BB and Git project on the host where `agy` 1.5.13 is already signed in. The fixture uses that existing Antigravity persona; there is no auth for the greeting CLI. No production project, tracker, routing file or checkout is modified. The reconciler takes its stances from a scratch copy of this checkout's `agents/`, with `acp-antigravity/gemini-4-neon:high` first for `auto-routine`. The existing [allocation](../../../allocation.json) maps `acp-antigravity` to `agy`.

## Setup

From this checkout with dependencies installed, use BB 0.50.1 and the matching supervision companion `25e77ab` from `~/dev/bb-plugins` (or its landed successor). Pick unused loopback ports if 47741/47742 are occupied. In a fresh shell, clear inherited target and worker selectors before starting the server:

```bash
for key in $(compgen -e); do
  case "$key" in BB_*|PI_WM_*|PI_SESSION_*|PI_CHECKPOINT|TRACKER_CLI) unset "$key" ;; esac
done
BB_BIN="$HOME/.bb-machines/mlegls.getbb.app/app-versions/0.50.1/node_modules/.bin"
"$BB_BIN/bb-app" --data-dir "$PWD/.wm/agy-bb" --server-bind-host 127.0.0.1 \
  --server-port 47741 --host-daemon-port 47742 --no-in-app-updates
```

In a second shell in the same checkout, target only that BB. The host must be connected before installation:

```bash
export BB_CLI="$HOME/.bb-machines/mlegls.getbb.app/app-versions/0.50.1/node_modules/.bin/bb"
export BB_DATA_DIR="$PWD/.wm/agy-bb" BB_SERVER_URL=http://127.0.0.1:47741 BB_HOST_DAEMON_PORT=47742
(
  set -euo pipefail
  test "$("$BB_CLI" status --json | jq -er .dataDir)" = "$BB_DATA_DIR"
  "$BB_CLI" machine list --json | jq -e 'any(.[]; .machineProviderId == null and .status == "connected")'
  git -C "$HOME/dev/bb-plugins" archive 25e77ab supervision | tar -x -C "$BB_DATA_DIR"
  (cd "$BB_DATA_DIR/supervision" && npm ci && "$BB_CLI" plugin build . && "$BB_CLI" plugin install --yes .)
  "$BB_CLI" plugin config supervision set checkout "$PWD"
  "$BB_CLI" plugin enable supervision
  "$BB_CLI" plugin config provider-acp set customAgents '[{"id":"antigravity","displayName":"Google Antigravity","command":"agy","args":["acp"],"permissionCli":{"full":["--dangerously-skip-permissions"],"insertAfterArgs":1},"nativeSkillRoots":{"user":[".gemini/config/skills"],"project":[".agents/skills"]}}]'
)
```

## First use

```bash
AGY_TRACER_BB_DATA_DIR="$BB_DATA_DIR" AGY_TRACER_RECORD="$PWD/.wm/agy-tracer-new" \
  bash docs/attachments/antigravity-workers-in-reconcile/live-drive.sh
```

It checks target identity, the daemon, the private worker-spawn RPC and the model catalog, then seeds a scratch `hello-tracer` ticket and starts the actual reconciler. Look for implement on `acp-antigravity`, route `acp-antigravity/gemini-4-neon:high`, drive and review workers, and `Landed: Hello, visitor!`. It copies reports and events into the specified new private directory before deleting the disposable project and worktrees. `AGENTS.md` and `.agents/skills/hello-tracer/SKILL.md` have separate markers, so the implement report plus tool events can distinguish uptake of instructions from discovery and use of the skill. Stop the disposable BB after the run.
