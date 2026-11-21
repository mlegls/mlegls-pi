# Supervision from Pi and Codex

Drive this against a disposable BB server. Do not install the plugin into a BB whose Pi hosts still load the old `extensions/supervision` extension: Pi fails on duplicate tool names.

## Setup

From the mlegls-pi change checkout, with `bun install --frozen-lockfile` done, and the `bb-plugins` companion change checked out:

```bash
export REPO="$PWD"
export PLUGIN="$HOME/dev/bb-plugins__worktrees/supervision-tools-as-bb-native-tools/supervision"
export BB_BIN="$HOME/.bb-machines/mlegls.getbb.app/app-versions/0.50.1/node_modules/.bin"
export FIXTURE=$(mktemp -d /tmp/supervision-drive.XXXXXXXX)
mkdir "$FIXTURE/pi"
# Use this host's existing Pi login and model settings; no credentials in the fixture repo.
ln -s "$HOME/.pi/agent/auth.json" "$FIXTURE/pi/auth.json"
ln -s "$HOME/.pi/agent/models.json" "$FIXTURE/pi/models.json"
printf '%s\n' '{"defaultTools":["read","bash","edit","write","codemode"],"codemode":{"mode":"on"}}' > "$FIXTURE/pi/settings.json"
export PI_CODING_AGENT_DIR="$FIXTURE/pi"
git clone --local --no-hardlinks "$REPO" "$FIXTURE/repo"
git -C "$FIXTURE/repo" worktree add -b native-pi-parent "$FIXTURE/repo__worktrees/native-pi-parent"
git -C "$FIXTURE/repo" worktree add -b native-codex-parent "$FIXTURE/repo__worktrees/native-codex-parent"
unset BB_CLI BB_THREAD_ID BB_PROJECT_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE
export BB_DATA_DIR="$FIXTURE/bb" BB_SERVER_URL=http://127.0.0.1:45691 BB_HOST_DAEMON_PORT=45692
```

Start `"$BB_BIN/bb-app" --data-dir "$BB_DATA_DIR" --server-bind-host 127.0.0.1 --server-port 45691 --host-daemon-port 45692 --no-in-app-updates` in a separate process with that environment. Choose unused ports if needed. Before installing, check `"$BB_BIN/bb" status --json` says `dataDir` is `$FIXTURE/bb`, and `"$BB_BIN/bb" machine list` shows the disposable server is connected. Then:

```bash
(cd "$PLUGIN" && npm ci && "$BB_BIN/bb" plugin build . && "$BB_BIN/bb" plugin install --yes .)
"$BB_BIN/bb" plugin config supervision set checkout "$REPO"
"$BB_BIN/bb" plugin enable supervision
project=$("$BB_BIN/bb" project create --name 'Supervision smoke' --root "$FIXTURE/repo" --json | jq -er .id)
```

## First use

Start one fresh thread for each provider. The first command lands on Pi's codemode surface; the second lands on Codex's native tools. `openai/gpt-6.1-sol` was listed by the disposable Pi provider and used for both workers. Codex uses the host's existing Codex login.

```bash
for provider in pi codex; do
  model=gpt-6.2-sol
  surface='Use the BB native tools directly.'
  if [ "$provider" = pi ]; then
    model=openai/gpt-6.1-sol
    surface='Use Pi codemode: find these tools in ALL_TOOLS and invoke them as tools.reconcile_status, tools.dispatch, tools.integrate.'
  fi
  "$BB_BIN/bb" thread spawn --project "$project" --environment "$FIXTURE/repo__worktrees/native-$provider-parent" \
    --provider "$provider" --model "$model" --reasoning-level low --parent-notifications off --title "Supervision smoke: $provider" \
    --prompt "$surface Call reconcile_status with issue supervision-smoke-absent; call dispatch with run native-$provider and one assignment: handle native-$provider-worker, model openai/gpt-6.1-sol, effort low, prompt 'Create and commit a checkout root file named SUPERVISION_SMOKE containing native-$provider; end your turn with done.' Inspect bb thread show --json for the worker and verify parentThreadId matches your own. Wait for the worker to finish, call integrate with its receipt or handle, and verify SUPERVISION_SMOKE landed in this checkout. Report results and thread IDs; no shell fallback for native tools and no messages to other threads." --json
done
```

Inspect each result with `"$BB_BIN/bb" thread log <id>` and each worker's parent link with `"$BB_BIN/bb" thread show <worker-id> --json`. Stop the disposable BB process and remove `$FIXTURE` after the drive. Production install and reload come after both companion changes land and Pi actually loads the updated package. If a reconciler or pickup watcher was already running from the replaced package checkout, its old fingerprint code still reads `extensions/supervision`. Temporarily recreate that empty directory in the code checkout until the processes refresh, then remove it. The new fingerprint reads `lib` only.

## Implementation drive

BB 0.50.1, disposable loopback instance on beelink, project cloned from `85cc4e3e`. Both callers returned `[]` for `reconcile_status` with the deliberately absent issue. The Pi caller discovered all eleven native tool names in `ALL_TOOLS` and called via codemode `tools`.

| Caller | Worker | Observed `parentThreadId` | Commit landed by native `integrate` | Marker |
| --- | --- | --- | --- | --- |
| Pi `thr_j5sthzj739` | `thr_gjxn8ps2pp` | `thr_j5sthzj739` | `6a34fff4` | `native-pi` |
| Codex `thr_q4vbe3ups3` | `thr_bkjeie3ht2` | `thr_q4vbe3ups3` | `cf4f4b1e` | `native-codex` |

Both workers reported `done`. After integration, `bb thread show` found both workers archived with their parent link intact, and both parent worktrees were clean.
