# PTC shell and transform: real model encounter

## Setup and readiness

Fresh verifier encounter on branch `dsh-ptc-shell-and-transform-edits-verify`, starting at `710463f`. Required deployment: local dsh Web with PTC and a real model turn. Actual target: this worktree's isolated `dsh/.local/home`, Web on loopback `127.0.0.1:49465`, and workspace explicitly redirected from the inherited external default to this worktree's `dsh/.local/fixture`. No external workspace was used for the task. Persona/auth: local anonymous Web identity plus DeepSeek API key read from the environment by `dsh/provider.deepseek.yml`; no secret is stored in config or evidence. Seed: `a.ts` and `b.ts` held `foo(1)` and `foo(2)`. The new workspace session showed Hashline preset, DeepSeek-V41-Flash model, and Workspace Write access.

`bun run setup` and `bun run --cwd dsh setup` completed. Web reported ready at `127.0.0.1:49354` with committed `dsh/cordis.yml` and `dsh/provider.deepseek.yml`, `DSH_TOOLS_MODE=ptc`. I discovered the isolated home inherited a workspace path outside this checkout; before creating the task session, stopped Web and changed only the isolated home workspace record to this checkout's fixture path, cleared its old session association, and restarted. Web reported ready at `127.0.0.1:49465`. The selected workspace shown in Web was `PTC fixture`. The earlier, wrongly targeted Web page was closed; no task/session was created there. After encounter, Web and the owned browser session were stopped.

Launch command (run from repo root):

```sh
PATH="$PWD/dsh/node_modules/.bin:$PATH" \
DSH_HOME="$PWD/dsh/.local/home" DSH_TOOLS_MODE=ptc \
DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY" \
  dsh web --patch "$PWD/dsh/cordis.yml" --patch "$PWD/dsh/provider.deepseek.yml" \
  --no-open --host 127.0.0.1 --port 0
```

## Stories and observations

Asked the model in Web to perform one `run_code` program: grep the two fixture files, transform `foo($A)` to `bar($A)` in both, then run the `lib/outline-read` test suite through `tools.shell` with a pipe. The model completed successfully.

- Grep found one `foo` call in each fixture file.
- Transform matched 2 sites in 2 files and changed them to `bar(1)` and `bar(2)`. A subsequent program read confirmed exact on-disk lines.
- Shell ran `bun test /Users/mlegls/dev/mlegls-pi__worktrees/dsh-ptc-shell-and-transform-edits-verify/lib/outline-read | cat`: `code: 0`, `timedOut: false`, `truncated: false`; stdout and stderr both nonempty; 55 tests passed across 6 files.
- Web trajectory shows a single `run_code` root with separate nested `grep` calls (one per file), `transform`, and `shell` rows. These are `SUBTOOL` entries in the UI trajectory corresponding to the nested dispatch sequence; no proxy implementation or manually run code was used.
- No implementation gap exposed; no repair was needed.

Screenshots are actual rendered Web interaction states (therefore `visual: true`):

- [01-model-turn.png](01-model-turn.png) — completed model answer with transformed contents and shell result fields.
- [02-trajectory.png](02-trajectory.png) — one `run_code` and individual nested grep/transform/shell entries.

## Reusable provider setup

Committed `dsh/provider.deepseek.yml` and a README reference. It uses `apiKeyEnv: DEEPSEEK_API_KEY`, selects `deepseek-official` / `deepseek-flash`, and disables `session-log-deepseek` plus `plugin-package-inventory-deepseek`, matching the documented workaround in `docs/issues/dsh-web-deepseek-extension-preparation-fails.md`. The previous provider prep failure was not separately reproduced in this encounter; the overlay-enabled model turn succeeded.
