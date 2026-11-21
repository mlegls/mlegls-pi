# Spawn workers on any BB provider

## Disposable BB setup

Run from the mlegls-pi change checkout with its dependencies installed. Use BB 0.50.1 and the matching supervision companion branch from `bb-plugins`. This fixture uses the host's existing Codex login and links the host's Pi login and model configuration into an isolated Pi agent directory. No project data is imported.

```bash
export REPO="$PWD"
export PLUGINS="$HOME/dev/bb-plugins"
export PLUGIN_REF=25e77ab # companion changes, or the landed revision
BB_BIN=${BB_BIN:-$HOME/.bb-machines/mlegls.getbb.app/app-versions/0.50.1/node_modules/.bin}
for key in $(compgen -e); do
  case "$key" in BB_BIN) ;; BB_*|PI_WM_*|PI_SESSION_*|PI_CHECKPOINT|TRACKER_CLI) unset "$key" ;; esac
done
export BB_BIN
export FIXTURE=$(mktemp -d /tmp/bb-worker-providers.XXXXXXXX)
export BB_DATA_DIR="$FIXTURE/bb" BB_SERVER_URL=http://127.0.0.1:45741 BB_HOST_DAEMON_PORT=45742
export BB_CLI="$BB_BIN/bb" BB_PI_BRIDGE_COMMAND="$REPO/bin/bb-pi"
export PI_CODING_AGENT_DIR="$FIXTURE/pi" PI_AGENTS_DIR="$FIXTURE/agents"
mkdir "$PI_CODING_AGENT_DIR"
ln -s "$HOME/.pi/agent/auth.json" "$PI_CODING_AGENT_DIR/auth.json"
ln -s "$HOME/.pi/agent/models.json" "$PI_CODING_AGENT_DIR/models.json"
printf '%s\n' '{}' > "$PI_CODING_AGENT_DIR/settings.json"
git -C "$PLUGINS" archive "$PLUGIN_REF" supervision | tar -x -C "$FIXTURE"
```

Start this in a foreground process with the environment above (choose unused ports and update both the launch command and exports if needed):

```bash
"$BB_BIN/bb-app" --data-dir "$BB_DATA_DIR" --server-bind-host 127.0.0.1 \
  --server-port 45741 --host-daemon-port 45742 --no-in-app-updates
```

Once the disposable server's local host connects, check its identity and install the plugin:

```bash
test "$("$BB_CLI" status --json | jq -er .dataDir)" = "$BB_DATA_DIR" &&
"$BB_CLI" machine list --json | jq -e 'any(.[]; .machineProviderId == null and .status == "connected")' &&
(cd "$FIXTURE/supervision" && npm ci && "$BB_CLI" plugin build . && "$BB_CLI" plugin install --yes .) &&
"$BB_CLI" plugin config supervision set checkout "$REPO" &&
"$BB_CLI" plugin enable supervision
```

## First use

```bash
bash docs/attachments/spawn-workers-on-any-bb-provider/live-drive.sh
```

The script creates a throwaway Git project and a scheduled Pi caller, then calls the same dispatch and integrate entry points as the native supervision tools. It launches a Codex-first stance and an explicit Pi worker. Look for each provider's selection, the caller as parent, plugin-sourced identity in `provider.env-resolved`, `done` in the final reply, the landed markers, and the archived worker threads. The Codex route requires capacity on `gpt-6.2-sol`; the Pi worker uses `openai/gpt-6.1-sol`.

For the offline rate-limit drill, use the actual reconciler with the repository's fake BB CLI. The fixture seeds an available Codex model followed by a Pi model, and injects BB's typed failure records with a message that contains no rate-limit text.

```bash
bun docs/attachments/spawn-workers-on-any-bb-provider/force-rate-limit.ts
```

Expect the reconciler to launch a new BB thread using Pi's `openai/second` and record `retries.provider=1`. The drill does not consume either account's quota or edit a BB database. When finished with the live drive, stop the disposable server and remove `$FIXTURE`.

## First observation

BB 0.50.1 on the local beelink, disposable loopback ports 45741/45742, BB data directory matched the fixture and its local daemon was connected. Codex worker `thr_kszf7ucji6` and Pi worker `thr_kkrjstbwfn` were children of `thr_d554qh4h29`. Both emitted `provider.env-resolved` with plugin-sourced `PI_WM_RUN`, `PI_WM_HANDLE`, and `PI_WM_ISSUE`. The Codex stance also received `PI_WM_AGENT=provider-smoke` and `PI_CHECKPOINT=0.65`. Both completed with `done`; integration fast-forwarded `ea126fc` and `ebd5681` into the clean fixture branch and archived both workers. The offline drill replaced `bbt-475b77d6` (`codex/first`) with `bbt-d7bf3726` (`pi/openai/second`) and recorded one provider retry.

The scripted replay started from a fresh seed on that server. Its caller `thr_mc226m797r` dispatched Codex `thr_zy8bzc7g6y` and Pi `thr_7aa9ubdq99`, then landed `c21dd1a` and `69a3c00` respectively. Both provider identities and archived thread states were observed again.
