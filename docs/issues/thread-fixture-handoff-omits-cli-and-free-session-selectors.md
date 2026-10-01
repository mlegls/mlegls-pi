---
stage: idea
author: session:01a0f7e9-02ec-7596-8bda-36fd838eb7cc
---

The [[projects/mlegls-pi/issues/thread-commands-in-pi]] fixture handoff supplies prepare/attach/inspect/cleanup but not an independent `ab thread ls --tree spawn` entry point or free-pi launch. PATH `ab` returned unrelated `ab tree` usage. Older evidence's `bun ab/main.ts` no longer exists in this checkout. The fixture's state directory is not an AB_STATE_DIR selector.

Workaround established from public docs and the owned running process's nonsecret environment: checkout `./bin/ab`, `XDG_STATE_HOME=ROOT/state`, `PI_BOARD_DIR=ROOT/board`, `PI_CODING_AGENT_DIR=ROOT/agent`, `ZMX_DIR=ROOT/zmx`. Free pi additionally sets `PI_WORKSPACE` to this checkout and unsets `AB_THREAD_ID`, `PI_SESSION_ID`, `PI_SESSION_FILE`, `ZMX_SESSION`, `PI_BOARD_TOPIC`. [Encounter](../attachments/thread-commands-in-pi/drive.md). Owner: mlegls-pi fixture/setup handoff.
