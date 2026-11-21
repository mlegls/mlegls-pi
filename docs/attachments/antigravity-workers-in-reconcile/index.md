# Antigravity reconcile tracer

Use a disposable BB and Git project on the host where `agy` 1.5.13 is already signed in. The fixture uses that existing Antigravity persona; there is no auth for the greeting CLI. No production project, tracker, routing file or checkout is modified. The reconciler takes its stances from a scratch copy of this checkout's `agents/`, with `acp-antigravity/gemini-4-neon:high` first for `auto-routine`. The existing [allocation](../../../allocation.json) maps `acp-antigravity` to `agy`.

## Setup

From this checkout with dependencies installed, use BB 0.50.1 and the matching supervision companion `25e77ab` from `~/dev/bb-plugins` (or its landed successor). Pick unused loopback ports if 47741/47742 are occupied. In a fresh shell, clear inherited target and worker selectors before starting the server:

```bash
(
  set -euo pipefail
  for key in $(compgen -e); do
    case "$key" in BB_*|PI_WM_*|PI_SESSION_*|PI_CHECKPOINT|TRACKER_CLI) unset "$key" ;; esac
  done
  BB_BIN="$HOME/.bb-machines/mlegls.getbb.app/app-versions/0.50.1/node_modules/.bin"
  export BB_DATA_DIR="$PWD/.wm/agy-bb" BB_PI_BRIDGE_COMMAND="$PWD/bin/bb-pi"
  export PI_AGENTS_DIR="$BB_DATA_DIR/agents" PI_CODING_AGENT_DIR="$BB_DATA_DIR/pi"
  mkdir -p "$BB_DATA_DIR"
  mkdir "$PI_AGENTS_DIR" "$PI_CODING_AGENT_DIR"
  cp -R agents/. "$PI_AGENTS_DIR/"
  bun -e 'const f=process.argv[1]; const text=await Bun.file(f).text(); const entry="acp-antigravity/gemini-4-neon:high, "; if (!text.includes(entry)) await Bun.write(f,text.replace(/^model: /m,"model: "+entry));' "$PI_AGENTS_DIR/auto-routine.md"
  ln -s "$HOME/.pi/agent/auth.json" "$PI_CODING_AGENT_DIR/auth.json"
  ln -s "$HOME/.pi/agent/models.json" "$PI_CODING_AGENT_DIR/models.json"
  jq -n --arg checkout "$PWD" '{packages:[$checkout],defaultTools:["read","bash","edit","write","codemode"],codemode:{mode:"on"}}' > "$PI_CODING_AGENT_DIR/settings.json"
  exec "$BB_BIN/bb-app" --data-dir "$BB_DATA_DIR" --server-bind-host 127.0.0.1 \
    --server-port 47741 --host-daemon-port 47742 --no-in-app-updates
)
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
  "$BB_CLI" plugin enable supervision || "$BB_CLI" plugin list --json | jq -e 'any(.plugins[]; .id == "supervision" and .enabled and .status == "running")'
  "$BB_CLI" plugin config provider-acp set customAgents '[{"id":"antigravity","displayName":"Google Antigravity","command":"agy","args":["acp"],"permissionCli":{"full":["--dangerously-skip-permissions"],"insertAfterArgs":1},"nativeSkillRoots":{"user":[".gemini/config/skills"],"project":[".agents/skills"]}}]'
)
```

## First use

```bash
AGY_TRACER_BB_DATA_DIR="$BB_DATA_DIR" AGY_TRACER_RECORD="$PWD/.wm/agy-tracer-new" \
  bash docs/attachments/antigravity-workers-in-reconcile/live-drive.sh
```

It checks target identity, the daemon, the worker-spawn RPC and the model catalogs, then seeds a scratch `hello-tracer` ticket and asks a Pi owner to call BB's `reconcile` tool through codemode. Look for the call in `owner-events.json`, implement on `acp-antigravity`, route `acp-antigravity/gemini-4-neon:high`, drive and review workers, and `Landed: Hello, visitor!`. It copies reports and events into the specified new private directory before deleting the disposable project and worktrees. `AGENTS.md` and `.agents/skills/hello-tracer/SKILL.md` have separate markers, so the implement report plus tool events can distinguish uptake of instructions from discovery and use of the skill. Stop the disposable BB after the run. Keep the private record separately and remove `.wm/agy-bb` before starting a fresh instance.

## Independent drive

The [independent CLI recording](drive.md) predates the Pi owner starting the run through the native tool. It records the same worker chain at `220be52c`.

## Implementation encounter

BB 0.50.1, agy 1.5.13, companion `25e77ab`, disposable loopback project `proj_ktbwnvpw9z`, owner `thr_dkwj3mnky8`. BB showed `thr_bcmiyaad7f` as the owner's child on `acp-antigravity`. The plugin's `workerRoute` returned `auto-routine`, `acp-antigravity/gemini-4-neon`, `high`; BB's environment event attributed `PI_WM_AGENT` and `TRACKER_CLI` to supervision.

Gemini followed the implement role: it opened the implement skill, made the one-line change, ran `bun hello.ts`, committed `82cdc8af`, and ended its first turn with `done` and a fenced YAML handoff. Before editing, it ran `bun "$TRACKER_CLI" text hello-tracer` as directed in the ticket; the tool event recorded exit 0. The reconciler consumed that handoff and launched drive without a format repair.

The report contained both fixture markers. The file-read events show agy opened `.agents/skills/hello-tracer/SKILL.md` in the scratch project's main checkout; the ticket named the skill by relevance but supplied no file path. No tool event opened `AGENTS.md`, and its marker appeared in the report, evidence that its instruction reached the session without a manual read. This establishes discovery and use in this BB/agy setup; it does not distinguish which internal layer supplied the initial skill listing.

Drive (`thr_pdpje2sakw`, Pi) and review (`thr_nf2rwqfxv9`, Pi) separately ran `bun hello.ts` and reported one `Hello, visitor!` line, empty stderr and exit 0. The reconciler landed `2b13c92` in the owner's scratch checkout and closed `hello-tracer` at `3aa3fef`. Its final state was `done` with no exceptions; all three workers were archived. The script took 5m01s, including readiness and evidence capture. The scratch project and worktrees were deleted, and both disposable BB ports were closed.

The first attempt reached the pre-existing host installation of supervision, which was running but lacked `workerSpawn`. The tracer now probes schema validation on that private RPC before creating a project. The disposable server uses the companion build and passed the probe. `agents/auto-routine.md` was restored after landing.
