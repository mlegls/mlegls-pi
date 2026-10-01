# zmx / pi launch constraints

Source research for [thread-core-and-workers-on-zmx](../../issues/thread-core-and-workers-on-zmx.md), 2026-10-01. Read-only research by session `01a0f6e2-b6f0-76f2-a372-9723d0e9fb40`; no runtime proof. Research worker retired without changes or daemons. These findings fix transport/SDK implementation details, not product lifetime decisions.

## zmx

Upstream examined: [neurosnap/zmx at 6f807920](https://github.com/neurosnap/zmx/tree/6f8079206f80e72f839298d6564bc923ecf52cfb), commit timestamp 2026-10-01T01:12:25Z. Latest release observed: [v0.8.1](https://github.com/neurosnap/zmx/releases/tag/v0.8.1), 2026-09-05, commit `8bab1f0173b07e79835ea372d749af3dbf0d0842`. Confirm the installed release's actual output when driving: no runtime zmx was active in the research checkout.

- Detached: `zmx run <name> -d <executable> <args...>`. Name precedes -d; release help showed an erroneous `run -d dev` example. Args beginning -d after the name are consumed as detach options, including executable arguments; use a wrapper when that matters. Run creates/reuses a login-bash pty, shell-quotes the command argv, appends CR and tracks an exit marker. Detached success is acknowledgment, not command completion. Existing-session commands are sequential. Sources: `src/main.zig:193–226,748–756,1826–1855,1905–1911`, `src/daemonize.zig:15–38`, `src/loop.zig:1150–1185`.
- Labels: `zmx set <name> thread=<id> role=<role>`; get/clear are available. In-memory for session lifetime. Keys/values allow alnum, dot, underscore, hyphen—not spaces/slashes/colon. Empty value deletes; name/start_dir/cmd reserved. Sources: `src/main.zig:623–635`, `src/label.zig:10–39`.
- `zmx ls` is **not JSON**: tab-separated key=value records, usually `name=N pid=P clients=C created=T [cwd=…] [cmd=…] [ended=…] [exit_code=…] [labels…]`. With ZMX_SESSION set, a leading arrow/current marker or two spaces appears. Error rows include name/err/status; do not interpret unreachable as “no such session”. `ls --short` is names only and skips error records. Empty full list has empty stdout and explanatory stderr. The pid is the pty child, not necessarily pi. Current source uses cwd, not README's start_dir picker example. Sources: `src/util.zig:947–1012`, `src/main.zig:1025–1057`, `src/loop.zig:1085`.
- `zmx history <name>` defaults to plain scrollback. --vt/--html exist; no line-count flag. Slice locally. Source: `src/main.zig:128–148,544–549`.
- `zmx send <name> <single-text-argv>` sends bytes with **no automatic carriage return**. Multiple text args are joined with one space. Piped input strips one final LF, retains CR. An argv containing a real CR submits; backslash-r text does not. Send is fire-and-forget without completion marker. Sources: `src/main.zig:577–592,1762–1796`.
- `zmx kill <name>... [--force]` waits for daemon EOF/socket unlink; normal kill sends HUP then KILL to the pty process group after 500ms. Escaped descendants need separate retirement cleanup. --force cleans unresponsive sockets and tolerates missing targets. Sources: `src/main.zig:289–339,1087–1136`, `src/loop.zig:1061–1075`.
- Missing-role shell: `(cd "$cwd" && env -u ZMX_SESSION zmx attach --labels "thread=$id role=$role" "$id.$role")`. Attach upserts and starts a login $SHELL (fallback /bin/sh) with no command; flags precede name. Existing session ignores replacement command. Inherited ZMX_SESSION selects the switch path, which bypasses label setting; label separately when switching. Sources: `src/main.zig:532–542,1537–1586`, `src/daemonize.zig:15–38`.

## Installed pi 0.99.1

Research located `mise which pi`, followed its symlink to the enclosing `@earendil-works/pi-coding-agent` and verified package.json 0.99.1. Implementers should repeat that lookup rather than hardcode the versioned install path; use its docs before the project's potentially older peer dependency.

Public SDK declarations (`dist/core/session-manager.d.ts:13–16,238–247,326,365–394`):

```ts
type NewSessionOptions = { id?: string; parentSession?: string };
SessionManager.create(cwd, sessionDir?, options?);
SessionManager.open(path, sessionDir?, cwdOverride?);
SessionManager.forkFrom(sourcePath, targetCwd, sessionDir?, options?);
manager.getSessionId();
manager.getSessionFile();
manager.getHeader();
manager.getEntries();
manager.createBranchedSession(leafId);
```

Precedents: `examples/sdk/11-sessions.ts:16–20,37–43,47–52`; `docs/sdk.md:36–55`; header format `docs/session-format.md:64–75`. Existing project fork: `extensions/workspace/index.ts:switchWorkspace`.

Empty-session constraint (`dist/core/session-manager.js:665–715,785–813,1094–1108`):
- create allocates id/path/header but doesn't write.
- Setup/custom/name entries alone don't flush; first user/assistant does.
- Opening a nonexistent or zero-byte path creates a new id. A valid header-only JSONL preserves its id.
- No public force-flush API found in the declarations; _rewriteFile is private.
- Derived minimal serialization, based on the documented header:

```ts
const m = SessionManager.create(cwd, dir, { id });
const file = m.getSessionFile()!;
writeFileSync(file, JSON.stringify(m.getHeader()) + "\n", { flag: "wx" });
const ready = SessionManager.open(file); // reopen before appending: m still has flushed=false
```

`forkFrom(source,cwd,dir,{id})` copies all non-header entries/tree, changes cwd/id, sets parentSession=source and writes immediately even for a header-only source. `createBranchedSession` instead mutates the manager to a new UUID/path, preserves cwd/sessionDir, copies root→leaf, has no target-cwd/explicit-id option, and may return an unpersisted setup-only branch. Sources: `dist/core/session-manager.js:1200–1209,1237–1249,1276–1289,1374–1413`.

CLI (`docs/cli.md:90–107`; `dist/main.js:192–215,230–351`; `dist/cli/args.js:89–98`):
- `pi --session /absolute/file.jsonl` opens that identity. Id lookup searches locally then globally; a global match can ask to fork, so the runner should use a path.
- `pi --fork /absolute/source.jsonl [--session-id <new-id>] [prompt]` always creates a target-project session and rejects an existing target id. It conflicts with --session/continue/resume/no-session.
- `pi --session-id <id>` opens exact project identity or creates; allowed id characters are alnum/._-, starting/ending alnum.

Restart constraints (`dist/cli/initial-message.js:5–19`; `dist/modes/interactive/interactive-mode.js:859–890,3363–3375,3383–3417,3473–3489`; `docs/keybindings.md:123–124`):
- A positional prompt is submitted on every startup, including --session; it is not just editor content. Prompt-free --session renders history and waits; it doesn't rerun the last user entry.
- pi's own loop exits via process.exit and doesn't restart itself. A wrapper must invoke a child pi repeatedly; `exec pi` replaces the wrapper and cannot return to the restart loop.
- Repeating --fork creates another identity; repeating the bootstrap prompt resubmits it.
- Installed defaults: Escape aborts, Ctrl-C clears editor (second within 500ms exits), Ctrl-D with empty editor/quit exit. The spec's Ctrl-C-abort rationale does not match these defaults. Preserve pi's keybindings; no remap is needed to implement the restart behavior.
