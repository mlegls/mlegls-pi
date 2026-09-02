# `pi-interactive-shell` and the local `session` extension

Checked 2026-09-02 against:

- local commit [`e4603a0`](../../extensions/session/index.ts)
- upstream commit [`d363e9a`](https://github.com/nicobailon/pi-interactive-shell/tree/d363e9a162c60be463871ac2132c582e654621c3)

## Conclusion

`pi-interactive-shell` covers the basic terminal operations and adds a user-facing overlay, takeover, completion notifications, structured monitors, and agent/worktree spawning. It is not a strict replacement for the local `session` extension.

The local extension still has three distinct behaviors:

1. one call can wait for output or exit across several terminal sessions, with `any` and `all` completion rules;
2. tmux sessions survive Pi runtime shutdown and can be rediscovered when the same Pi session resumes;
3. one list reports all terminals with PID, current command, working directory, and exit status.

## Capability comparison

| Local `session` behavior | Upstream coverage | Evidence |
| --- | --- | --- |
| Spawn a command in a PTY with a chosen working directory | Covered | Local [`spawn`](../../extensions/session/tmux.ts#L194-L220). Upstream creates a `PtyTerminalSession` with `command` and `cwd` for [headless dispatch](https://github.com/nicobailon/pi-interactive-shell/blob/d363e9a162c60be463871ac2132c582e654621c3/index.ts#L937-L958). |
| Query status and bounded terminal output | Covered, with different limits | Local `view` captures up to 2,000 lines and supports a 30-second change wait in [`tmux.ts`](../../extensions/session/tmux.ts#L245-L274). Upstream queries default to 20 lines and cap at 200 lines and 50 KB in [`session-query.ts`](https://github.com/nicobailon/pi-interactive-shell/blob/d363e9a162c60be463871ac2132c582e654621c3/session-query.ts#L12-L64). Upstream also adds offset, incremental, and drain reads in the same file. |
| Wait for one session to produce changed output, identified by a cursor | Not covered directly | Local hashes status and rendered output into a cursor, then long-polls for a changed hash in [`tmux.ts`](../../extensions/session/tmux.ts#L245-L274). Upstream has polling, quiet updates, dispatch completion, and monitor triggers, but its [tool schema](https://github.com/nicobailon/pi-interactive-shell/blob/d363e9a162c60be463871ac2132c582e654621c3/tool-schema.ts) has no cursor-based long-poll action. |
| Wait across up to 16 sessions, returning on the first change or after every process exits | Not covered | Local exposes `wait`, `ids`, `mode`, and per-session cursors in [`index.ts`](../../extensions/session/index.ts#L23-L49), implemented by [`waitMany`](../../extensions/session/tmux.ts#L276-L303). Upstream can run [several headless dispatches](https://github.com/nicobailon/pi-interactive-shell/blob/d363e9a162c60be463871ac2132c582e654621c3/README.md#L181-L195), but it has no aggregate `any` or `all` wait over session IDs. Completion notifications replace some `any exit` uses, not output-change waits or an `all` barrier. |
| Send literal text and optionally press Enter | Covered | Local `send` uses a tmux paste buffer and defaults to submitting in [`tmux.ts`](../../extensions/session/tmux.ts#L305-L314). Upstream accepts text and `submit: true` in [`index.ts`](https://github.com/nicobailon/pi-interactive-shell/blob/d363e9a162c60be463871ac2132c582e654621c3/index.ts#L1472-L1489). Upstream does not submit text by default. |
| Send control, navigation, and function keys | Covered | Local validates tmux key names in [`tmux.ts`](../../extensions/session/tmux.ts#L10-L11). Upstream implements these keys and adds modifiers, keypad keys, bracketed paste, and raw hex bytes in [`key-encoding.ts`](https://github.com/nicobailon/pi-interactive-shell/blob/d363e9a162c60be463871ac2132c582e654621c3/key-encoding.ts). |
| Keep running and exited terminals until explicit `end` | Not covered | Local enables tmux `remain-on-exit` and never handles `session_shutdown` in [`tmux.ts`](../../extensions/session/tmux.ts#L203-L208) and [`index.ts`](../../extensions/session/index.ts). Upstream calls `killAll()` on [`session_shutdown`](https://github.com/nicobailon/pi-interactive-shell/blob/d363e9a162c60be463871ac2132c582e654621c3/index.ts#L1169-L1175). Ordinary background sessions are removed 30 seconds after exit in [`session-manager.ts`](https://github.com/nicobailon/pi-interactive-shell/blob/d363e9a162c60be463871ac2132c582e654621c3/session-manager.ts#L235-L253), while completed dispatch PTYs have a documented five-minute inspection window in the [README](https://github.com/nicobailon/pi-interactive-shell/blob/d363e9a162c60be463871ac2132c582e654621c3/README.md#L142-L156). |
| Rediscover every terminal and its command, cwd, PID, current process, status, and exit code | Partially covered | Local stores metadata in tmux and returns it from [`list`](../../extensions/session/tmux.ts#L333-L355). Upstream `listBackground` reports background session ID, launch command, reason or monitor state, running/exited state, and duration in [`index.ts`](https://github.com/nicobailon/pi-interactive-shell/blob/d363e9a162c60be463871ac2132c582e654621c3/index.ts#L1727-L1744). It does not list active overlay sessions or return cwd, PID, or current process there. |
| Run several terminals concurrently | Partially covered | Local creates independent tmux sessions without an overlay limit. Upstream supports several headless dispatches but permits only one interactive overlay, as shown by the overlay guard in [`index.ts`](https://github.com/nicobailon/pi-interactive-shell/blob/d363e9a162c60be463871ac2132c582e654621c3/index.ts#L961-L969). |
| Save truncated query output to an automatic full-output file | Not equivalent | Local writes the captured snapshot to a temporary log when Pi's result limit truncates it in [`index.ts`](../../extensions/session/index.ts#L79-L100). Upstream supports configurable handoff snapshots and output transfer, but ordinary status queries return bounded content and pagination instead of an automatic full-output path. Its raw query log is capped and trimmed at 1 MB in [`pty-log.ts`](https://github.com/nicobailon/pi-interactive-shell/blob/d363e9a162c60be463871ac2132c582e654621c3/pty-log.ts#L1-L14). |

## What upstream adds

Upstream provides features absent from the local extension:

- an observable overlay with user takeover, focus switching, scrolling, backgrounding, and reattachment;
- dispatch completion notifications and hands-free quiet or interval updates;
- stream, poll-diff, and file-watch monitors with structured event history;
- structured Pi, Codex, Claude, Cursor, and custom-agent spawning, including worktrees and Pi session forks;
- timeouts, quiet auto-exit, output transfer, configurable snapshots, bracketed paste, and raw byte input;
- a direct `zigpty` and xterm backend instead of tmux. Its runtime dependencies are listed in [`package.json`](https://github.com/nicobailon/pi-interactive-shell/blob/d363e9a162c60be463871ac2132c582e654621c3/package.json#L40-L51).

## Replacement decision

Install upstream if the goal is observable interactive shells or delegated-agent supervision. Keep the local extension if workflows depend on multi-session `wait`, terminal survival across Pi shutdown or resume, or one complete terminal inventory.

Upstream would become a practical replacement for the local tool if it added:

1. an aggregate wait action over session IDs with `any` and `all` rules;
2. an opt-in lifetime that does not kill PTYs on `session_shutdown` and can restore them on resume;
3. an all-session listing with cwd, PID, current command, status, and exit code.
