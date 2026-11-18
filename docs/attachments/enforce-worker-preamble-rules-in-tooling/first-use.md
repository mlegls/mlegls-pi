# Worker guard first use

From the driver’s linked `mlegls-pi` worktree, run `mise run setup` if dependencies are missing. Start a throwaway Pi session with an authenticated model already available to Pi:

```sh
PI_WM_HANDLE="$(git branch --show-current)" PI_WM_ISSUE=launch-ticket \
  pi --no-session --tools +grep --no-mcp -ne -e builtin:codemode \
  -e ./extensions/guard/index.ts -e ./extensions/system-prompt/index.ts
```

Ask Pi to make the calls verbatim. For the canonical path, substitute the absolute path printed by `dirname "$(git rev-parse --path-format=absolute --git-common-dir)"`.

- `read` and `grep` with path `docs/issues`, and `bash` with `ls docs/issues`. Each should point to the tracker CLI.
- `git -C <canonical-path> merge --help`, `cd <canonical-path> && ab task finish`, and `git push --dry-run /does/not/exist HEAD:main`. Each should point to handing the branch back to the parent.
- `echo first && pkill --help`, then `git commit --dry-run -m 'record pkill behavior; killall wording'`. The first should tell the worker how to stop its own process; the second should reach Git.
- Ask for a final answer without a status. Pi should send itself one follow-up asking for the status and handoff, before settling.

For the browser text, compare the system prompt with this launch and with `--no-mcp` replaced by `-e builtin:mcp` on a host with Chrome and/or CUA configured. Only the configured namespace's guidance should appear. This applies with or without `PI_WM_HANDLE`; no page or app needs to be opened.

Try the tracker CLI separately in a scratch vault. This keeps the reservation and provisional claim away from the actual issue tracker:

```sh
(
  cli="$PWD/skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"
  vault="$(mktemp -d)" || exit
  trap 'rm -rf "$vault"' EXIT
  cd "$vault" || exit
  mkdir issues
  export PI_WM_HANDLE=first-use PI_WM_ISSUE=launch-ticket
  bun "$cli" create launch-ticket --fields '{"stage":"ticket","assignee":"agent","author":"session:probe"}' --body-file /dev/null
  bun "$cli" update launch-ticket --fields '{"claimed-by":"session:probe"}'
  bun "$cli" close launch-ticket
  bun "$cli" create child --fields '{"stage":"ticket","assignee":"agent","author":"session:probe","part-of":"launch-ticket","claimed-by":"reconcile:probe/refine"}' --body-file /dev/null
  bun "$cli" fields child
)
```

Expect the claim update and close to be refused with target-landing guidance. The provisional child claim should be saved.
