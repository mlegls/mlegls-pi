# Board host Web verification

The board host shares pi's machine-wide JSONL store. Verify it in anonymous-local dsh Web, not Cloud, with one isolated home and a workspace rooted at this checkout.

## Launch

Build the pinned dsh plugins first:

```sh
bun run --cwd dsh setup
```

Set `DEEPSEEK_API_KEY` in the shell environment; never put its value in a profile, command line, or recorded output. From the repository root, launch with pi's process identity removed. Keep `PI_BOARD_DIR` unchanged if pi uses a non-default board store; when unset, both use `~/.local/share/pi-board`.

```sh
env -u PI_BOARD_TOPIC -u PI_BOARD_NAME \
  -u PI_WM_RUN -u PI_WM_HANDLE -u PI_WM_AGENT -u PI_WM_PARENT_SESSION \
  DSH_HOME="$PWD/dsh/.local/board-host-verify" \
  DSH_TOOLS_MODE=ptc \
  PATH="$PWD/dsh/node_modules/.bin:$PATH" \
  dsh web \
    --patch "$PWD/dsh/cordis.yml" \
    --patch "$PWD/dsh/provider.deepseek.yml" \
    --patch "$PWD/dsh/board/verification/web.yml" \
    --patch "$PWD/dsh/board/verification/child-tools.yml" \
    --no-open --host 127.0.0.1 --port 0
```

Keep the printed login token private. Open the local URL in the verifier browser, use the in-app workspace picker to select this checkout, and choose the Hashline preset. `web.yml` replaces the native directory chooser with the browser picker. `child-tools.yml` adds one-shot `subagent` and `job_*` controls to the custom Hashline preset; adding them only as host plugins does not expose them to that preset.

## Stories

Use a unique `verify/<run>/...` topic prefix and explicit Pi mailbox sender. The test-only home, board log, provider profile and server must stay local.

- **Exchange and idle wake:** from the resumed/idle DSH session, subscribe with `wake: true`. Post to that topic with `ab mail <topic> <body>`. DSH should wake, full-read the exact message, acknowledge it and reply to the Pi sender's `mail/<suffix>` topic.
- **Wake retraction:** while DSH is busy in a short `tools.shell({command: 'sleep 10'})`, post to its subscribed topic. Have DSH full-read or explicitly acknowledge the message before the sleep ends; there should be no second follow-up turn.
- **Resume:** stop and restart Web with the same `DSH_HOME` and all six `env -u PI_*` options. Post to the persisted DSH subscription and verify it is read after resume.
- **Child disposal:** call the `subagent` tool once with `run_in_background: true`. Its single PTC program subscribes with wake and posts a tagged readiness message, then stays busy in a long shell sleep. Read that exact readiness post to obtain `from.session`, derive its mailbox as `mail/` plus the session ID with hyphens removed and sliced to the last eight characters, then `job_kill` that exact job and wait for it to settle. Full-read the derived mailbox and check for `started`, `turn-end` with an aborted reason, and `exited` from the same child session. Kill before the PTC shell timeout; a sleep that times out naturally tests normal disposal, not cancellation.

The focused host regression is `bun test board/index.test.ts` from `dsh/`. Stop the Web process and the named verifier browser session after the encounter.
