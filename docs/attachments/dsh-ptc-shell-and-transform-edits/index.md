# Shell and transform: first use

Worker checkout `dsh-ptc-shell-and-transform-edits`, pinned `@deepseek-ai/dsh` 0.1.7-rc.2. Anonymous-local Web, no Cloud target, no provider credential. `bun run setup` and `bun run --cwd dsh setup` completed. An isolated `dsh/.local/home` was created under this checkout. Trial files `dsh/.local/fixture/{a,b}.ts` start as `export const a = foo(1);` and `export const b = foo(2);`; the setup fixture is reset to that seed after the trial. No inherited deployment selector was used.

Start normal Web from the repository root:

```sh
PATH="$PWD/dsh/node_modules/.bin:$PATH" DSH_HOME="$PWD/dsh/.local/home" \
  dsh web --patch "$PWD/dsh/cordis.yml" --no-open --host 127.0.0.1 --port 0
```

Web started on loopback and printed a local token URL; the token is not recorded. To replay the no-provider model-free first use, append `--patch "$PWD/dsh/.local/trial.yml"`. The ignored temporary host plugin in that patch creates a live `hashline` agent and dispatches a single `run_code` program through `ctx.tools.execute`. It is diagnostic setup, not production overlay. It writes `dsh/.local/trial.json` and an isolated dsh session log; no user credentials or provider calls are used.

The program called `tools.grep({pattern:'foo',path:'dsh/.local/fixture'})`, then `tools.transform({files:['dsh/.local/fixture/a.ts','dsh/.local/fixture/b.ts'],pattern:'foo($A)',rewrite:'bar($A)',language:'ts'})`, then a local `$` template wrapping `tools.shell` for ``bun test lib/outline-read | cat``. It completed with `isError: false`: grep found both files, transform reported two matches/two edited files (`bar(1)`/`bar(2)`), shell reported `code: 0`, `truncated: false`, `timedOut: false`, and 55 passing tests. The persisted dsh session `trial-1790501064866` logged `tool/ptc-dispatch` seq 4 `grep`, seq 6 `transform`, seq 8 `shell`, each with `isError: false` and the same root call id. `bunx tsc` on the two plugin entry points (strict, bundler, bun-types) and `git diff --check` passed. `bun-axi test lib/outline-read`: 55 passed. No screenshot or interactive model turn in this packet; a fresh verifier follows.

The shell binding does not expose a sandbox escalation request, and the transform's host filesystem write follows hashline's existing trusted-host edit policy rather than the shell sandbox. Multi-file edits have the hashline partial-failure behavior; no cross-file rollback.
