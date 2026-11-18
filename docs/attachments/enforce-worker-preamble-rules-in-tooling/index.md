# Worker guard drive

## Predictions before use

- `read`, `grep`, and shell access to `docs/issues` will refuse with the tracker command.
- Canonical merge and task finish, and a push to `main`, will refuse with a parent handoff alternative.
- A shell command in command position will refuse `pkill` with process-stop guidance; a quoted commit message will reach Git.
- An unstated status will elicit one follow-up asking for status and handoff.
- With MCP off, neither browser namespace gets guidance; when present, each configured namespace does, in worker and interactive sessions.
- In a scratch tracker, launched-issue claim and close will refuse with landing guidance; provisional child claim survives.
- The reduced worker preamble will omit the moved rules, including the role-level repetitions.
## Encounter

Tested `bdf78cd1` in the linked driver worktree with Pi 1.5.2, an authenticated local Pi model and installed dependencies. Used the throwaway launch and scratch tracker in [first-use.md](first-use.md). Used `--mode json` to observe tool results and conversation events; no persistent Pi session or browser page was needed. The canonical checkout was the path returned by the handoff's Git command; the push probe was a dry run to a nonexistent path.

| Check and replay | Observed |
| --- | --- |
| `read` and `grep` on `docs/issues`, and `ls docs/issues` via Bash | Met: all three refused with `bun ~/.pi/agent/skills/tracker/scripts/issues.ts text <slug>`. The default throwaway launch does not expose grep; replayed with `--tools grep` and a direct call. |
| `git -C <canonical> merge --help`, `cd <canonical> && ab task finish`, `git push --dry-run /does/not/exist HEAD:main` | Met: each refused with “Commit on your worker branch and report your handoff; your parent integrates and publishes it.” |
| `echo first && pkill --help`, then `git commit --dry-run -m 'record pkill behavior; killall wording'` | Met: the first pointed to stopping one's own process by PID, process tool or checkout task. The second reached Git and returned `nothing added to commit`. |
| With the guard and `--tools grep`, ask Pi to grep `docs/issues` then reply exactly `Hello`; comply with any follow-up | Met: JSON events showed `Hello`, one custom follow-up, then an assistant response beginning `done` and summarizing the action. |
| Scratch tracker sequence from the handoff | Met: both the claim update and close refused with “Report your handoff; the reconciler closes the issue and clears its claim after target landing.” `fields child` retained `claimed-by: reconcile:probe/refine`. Temporary tracker removed. |
| Compare Pi's prompt with MCP off and Chrome available | Partly met: with MCP off, neither namespace's guidance appeared. Merely replacing `--no-mcp` with `-e builtin:mcp` did not establish Chrome availability in the throwaway launch. Replayed with a scratch extension calling `pi.registerMcpServer('chrome', {command:'bunx', args:['chrome-devtools-mcp@latest','--isolated','--headless'], exposure:'direct'})`, before the guard and system-prompt extensions. In both the worker and the interactive-persona launch (worker handle and issue unset), codemode `ALL_TOOLS` reported `mcp__chrome__click`, `mcp__chrome__close_page` and `mcp__chrome__drag`; an extension loaded last used Pi's public `ctx.getSystemPrompt()` in `before_agent_start` and found no Chrome tool-use guidance in either prompt. Expected guidance whenever those tools are available. CUA was unobservable: `pi mcp list` reported `cua-driver` missing. |
| Inspect the common and role instructions delivered to a newly launched worker | Unobservable in the handoff's manually launched Pi, which did not load the role preamble. Source removal left for review. |

## Frictions

The documented minimal launch leaves grep off; the direct `--tools grep` replay resolved it. The MCP comparison needed explicit scratch registration to distinguish an absent tool catalog from absent guidance. The missing guidance on the confirmed Chrome catalog is the ticket's acceptance gap; review can repeat the scratch launch without opening a page.

## Review and re-drive

The built-in MCP handler runs after the package's `before_agent_start` handler. It fills `mcp_servers` for indirect tools and waits for direct-tool connections. The previous prompt captured neither on first use. The repaired prompt reads the catalog at render time. The probe observed the actual provider payload, then exited before sending it. It did not open a browser page or native app.

| First-turn setup | Worker: Chrome / CUA guidance | Interactive: Chrome / CUA guidance |
| --- | --- | --- |
| `--no-mcp` | absent / absent | absent / absent |
| `-e builtin:mcp`, both configured for codemode | present / present | present / present |
| `-e builtin:mcp`, Chrome only, direct registration | present / absent | present / absent |

To replay, add a temporary `-e ./observe.ts -p probe` to the first-use launch. For the interactive persona, unset `PI_WM_HANDLE` and `PI_WM_ISSUE`. For the direct registration case, use a scratch `PI_CODING_AGENT_DIR` with an available model and no `mcp.json` (file entries override extension registrations); load the Chrome registration from the encounter above. Its active tool list included `mcp__chrome__click` and `mcp__chrome__close_page`.

```ts
export default pi => pi.on('before_provider_request', event => {
  const request = JSON.stringify(event.payload);
  console.log({ chrome: request.includes('drives a headless browser'), cua: request.includes('drives native apps') });
  process.exit(0);
});
```

**Preambles:** With `PI_AGENTS_DIR="$PWD/agents"`, called `lib/wm.ts`'s exported `prompt({run:'probe', handle:'probe', role, prompt:''})` for implement, drive and review. Each included its role's opening sentence. None contained the moved tracker path, reservation, close, canonical merge or browser-tool instructions.

All seven claims now hold. The replay command includes `--tools +grep`; Pi reported grep active alongside codemode. The seven affected test files passed (60 tests), and `tsc --noEmit` passed. In ten local guard calls, a protected push averaged 13 ms for Git checkout/config resolution; a tracker path refusal averaged 0.1 ms.
