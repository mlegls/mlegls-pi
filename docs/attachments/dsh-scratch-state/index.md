# dsh scratch-state first-use verification

Tested revision: rebased `dsh-scratch-state-verify` branch, including scratch overlay on main's `dsh` tools. `bun run --cwd dsh setup` completed with frozen install and plugin build.

## Setup and target

- Required: worker-owned local dsh Web with a configured DeepSeek model, PTC mode, and the ticket's live-session `run_code` workflow.
- Target: this checkout's dsh package and isolated `DSH_HOME` at `dsh/.local/home`; local Web initially on `127.0.0.1:51517`, then restarted on `127.0.0.1:52050`. No external/cloud target.
- Persona/auth: Web's generated local login token URL (used to authenticate the local session); model set by the committed `provider.deepseek.yml`, reading `DEEPSEEK_API_KEY` from the environment. No secret values recorded.
- Seed/state: a fresh local session wrote key `verify-dsh-scratch-20260927` with JSON `{rows:[2,3,5],total:10}`. The same session was restored after Web service restart with the same `DSH_HOME`.
- Entry point, from repo root: `PATH="$PWD/dsh/node_modules/.bin:$PATH" DSH_HOME="$PWD/dsh/.local/home" DSH_TOOLS_MODE=ptc dsh web --patch "$PWD/dsh/cordis.yml" --patch "$PWD/dsh/provider.deepseek.yml" --no-open --host 127.0.0.1 --port 0`. Open the full login URL printed by the server, including its token; do not use the bare root.
- Readiness: local login URL loaded the authenticated DeepSeek Harness UI; its Hashline preset and model selector were visible. Model requests and nested PTC dispatches succeeded. After restart, the saved session appeared in the UI and accepted another model-backed turn.

## Claims and observations

- **Two `run_code` calls in one live session:** held. Asked the model to store the JSON with `scratch_put` in one call, then read it with `scratch_get` in a second. The second result was `found: true`, exact value `{"rows":[2,3,5],"total":10}`. The session trajectory shows two `run_code` `tool/ptc-dispatch` entries and nested `scratch_put` / `scratch_get` calls.
- **Persistence choice:** memory-only; no scratch state is appended as a session event. The page reload alone retained the value in the still-live session. After stopping the Web service, starting a new process with the same `DSH_HOME`, reopening the saved session and issuing a fresh `run_code` read, `scratch_get` returned `found: false`. This establishes loss across session restoration/process restart; event persistence and fork inheritance are not expected under the chosen design. The existing API rationale is recorded in [`docs/issues/dsh-scratch-state.md`](../../issues/dsh-scratch-state.md).

## Screenshots

- [01 — authenticated Web home, ready for first use](01-ready.png)
- [02 — requested two-call prompt](02-prompt.png)
- [03 — successful JSON roundtrip in Chat](03-roundtrip.png)
- [04 — trajectory with both dispatches and nested tool results](04-trajectory.png)
- [05 — page reload retained state in the still-live session](05-page-reload.png)
- [07 — restored session after server restart; value absent](07-process-restart.png)
- [08 — trajectory confirms post-restart `scratch_get` returned absent](08-final-trajectory.png)

No fork was tested because persistence was chosen to be memory-only, not lineage-persistent. The local server and the worker's browser session are stopped after capture.
