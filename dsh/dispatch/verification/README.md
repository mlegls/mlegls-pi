# Live dispatch probe

This opt-in driver uses the real Web host, provider, PTC program, router,
continuable runtime and shared board. It is not loaded in normal sessions.
It creates a Hashline parent rooted in the launching checkout, lets it finish
its initial turn, then runs a three-child `Promise.all` program. Children wait
at a pre-step gate until all handles have returned, so the log can establish
that dispatch does not wait for completion and that the parent is idle.

The research child reads `package.json`. The fill child runs `pwd` and
`git rev-parse HEAD` through `tools.shell` in a new worktree without editing.
The third child throws deliberately from `agent/pre-step`: the runtime, not
the probe, emits `agent/error` and the board host reports `crashed`.
These children share the DSH process; they have no independent PID to kill.
This probe does not establish monitoring across host-process death.

After the setup in [../README.md](../README.md), initialize a fresh Web home:

```sh
export DSH_HOME="$PWD/dsh/.local/dispatch-verify"
bash dsh/dispatch/run.sh web --no-open --host 127.0.0.1 --port 0
# Stop Web once it has initialized its storage, then select this checkout:
DSH_HOME="$DSH_HOME" bun dsh/add-workspace.ts "$PWD" dispatch-verify
```

Generate an absolute-path patch and restart:

```sh
bun -e 'import {resolve} from "node:path"; await Bun.write(process.env.DSH_HOME + "/driver.yml", JSON.stringify([{insert:[{id:"dispatch-verification",name:resolve("dsh/dispatch/verification/driver.js")}]}]));'
bash dsh/dispatch/run.sh web --patch "$DSH_HOME/driver.yml" \
  --no-open --host 127.0.0.1 --port 0
```

`$DSH_HOME/dispatch-probe.jsonl` records parent/child IDs, tool surfaces,
status transitions, returned handles, notices and errors. The parent should
wake and read the child mail topics. Read those topics independently with
`ab lib board read '{"topic":"mail/<suffix>"}'`; match the exact child IDs,
not just tags or message counts. The writer handle gives its branch and cwd.

The driver starts a fresh parent on every host launch. Stop Web after the
parent has reported the results; inspect and remove only its clean no-edit
writer worktree and branch. Keep login URLs and credentials out of evidence.
This is a backend encounter, not a browser UI check or independent acceptance.
