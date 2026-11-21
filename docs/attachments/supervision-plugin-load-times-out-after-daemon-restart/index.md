# Smoke test supervision across a BB restart

Use an isolated BB data directory. Restarting the shared BB instance interrupts active threads. The sandbox uses the local provider CLIs and their existing login state; it does not need a BB cloud account. Commands below run from the `mlegls-pi` checkout being verified, using the installed BB 0.50.1 app and Node 24. Pick two unused loopback ports if 40186 and 40187 are in use.

## Prepare

`BB_APP_DIR` is the installed `node_modules/bb-app` directory (the one containing `dist/bb-app.js`). `BB_PLUGINS_REPO` is the `bb-plugins` repository holding the candidate commit.

```bash
: "${BB_APP_DIR:?set BB_APP_DIR to the installed bb-app package path}"
: "${BB_PLUGINS_REPO:?set BB_PLUGINS_REPO to the bb-plugins repository path}"
mkdir -p .wm
export BB_TEST_DATA_DIR="$PWD/.wm/supervision-restart-bb"
export BB_TEST_PORT=40186 BB_TEST_HOST_PORT=40187

git -C "$BB_PLUGINS_REPO" worktree add --detach "$PWD/.wm/supervision-restart-plugin" c9c60fff12fa4d3fc6a74590c62a955b9855a0c9

sandbox_bb() {
  env -u BB_CLI -u BB_THREAD_ID -u BB_PROJECT_ID -u BB_ENVIRONMENT_ID -u BB_HOST_ID \
    BB_SERVER_URL="http://127.0.0.1:$BB_TEST_PORT" BB_DATA_DIR="$BB_TEST_DATA_DIR" \
    "$BB_APP_DIR/host-daemon/dist/bb" "$@"
}

sandbox_start() {
  env -u BB_CLI -u BB_SERVER_URL -u BB_DATA_DIR -u BB_THREAD_ID -u BB_PROJECT_ID -u BB_ENVIRONMENT_ID -u BB_HOST_ID \
    node "$BB_APP_DIR/dist/bb-app.js" --data-dir "$BB_TEST_DATA_DIR" \
    --server-port "$BB_TEST_PORT" --host-daemon-port "$BB_TEST_HOST_PORT" --no-in-app-updates
}
```

Run `sandbox_start` in the foreground in another shell (export the function and variables or define it there). Wait for the server and host daemon to listen, and check that `sandbox_bb machine list` shows the sandbox host. Then:

```bash
plugin="$PWD/.wm/supervision-restart-plugin/supervision"
(cd "$plugin" && npm ci && sandbox_bb plugin build .)
sandbox_bb plugin install --yes "$plugin"
sandbox_bb plugin config supervision set checkout "$PWD"
```

For an Antigravity worker, configure the sandbox's `provider-acp` `customAgents` with your local `antigravity` entry before restarting. From an already configured instance, `bb plugin config provider-acp --json | jq -c '.values.customAgents | fromjson | map(select(.id == "antigravity"))'` extracts the entry. Inspect it locally first and transfer only command and argument settings that contain no credentials. Pi, Codex, Claude Code, Hermes and Antigravity use their local provider CLI auth.

## Restart and reach the RPC

Stop `sandbox_start` with Ctrl-C and start it again with the same data directory and ports. Do not reload supervision. Once `sandbox_bb machine list` answers:

```bash
sandbox_bb plugin list --json | jq -e '.plugins[] | select(.id == "supervision" and .status == "running") | .status'
sandbox_bb plugin rpc call supervision workerSpawn --json
```

The first command prints `"running"`. The second returns `invalid_input` (HTTP 400, intentionally no worker input), proving the RPC registered during startup.

## Spawn a worker

Use the local host ID from `sandbox_bb machine list`. Create a disposable project, then call the same RPC with a worker checkout and provider. Repeat for each provider installed on the target before the change. Each call should return a thread ID. Use `sandbox_bb thread log <thread-id> --all` to separate spawn failures from provider login or turn errors.

```bash
host=$(sandbox_bb machine list --json | jq -er 'if length == 1 then .[0].id else error("choose the sandbox host") end')
project=$(sandbox_bb project create --name 'Disposable supervision restart' --root "$PWD" --machine "$host" --json | jq -er .id)
provider=pi # also codex, claude-code, acp-hermes-agent, acp-antigravity on Beelink
jq -n --arg project "$project" --arg path "$PWD" --arg provider "$provider" \
  '{projectId:$project,path:$path,providerId:$provider,title:("Restart smoke " + $provider),
    prompt:"Reply with ok. Do not change any files or call tools.",metadata:{env:{PI_WM_HANDLE:"restart-smoke"}}}' |
  sandbox_bb plugin rpc call supervision workerSpawn --input-file /dev/stdin --json
```

Stop the sandbox launcher with Ctrl-C when finished. Remove the detached plugin worktree with `git -C "$BB_PLUGINS_REPO" worktree remove "$PWD/.wm/supervision-restart-plugin"`.

## Implementation trial

On BB 0.50.1, temporary log markers in the baseline (`bb-plugins` `35262d7`) printed `before providers.list`, then the startup factory timed out after 30,000 ms. It never reached the marker after `providers.list` or the one before `settings.get`. Installing the same instrumented code on the running sandbox reached all markers.

After rebuilding from `c9c60ff` and restarting the same sandbox, supervision showed `running` and `workerSpawn` returned `invalid_input` without a reload. The worker RPC returned a thread ID on each of Beelink's five previously installed providers: Pi, Codex, Claude Code, ACP Hermes and ACP Antigravity. Four replied; Claude Code created the thread, then reported an expired OAuth session on the first turn. The live BB instance was left unchanged.
