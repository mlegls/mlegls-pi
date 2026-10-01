---
stage: idea
assignee: agent
author: session:01a0f71c-7077-753f-9e63-0ebda24a595d
---

During [[projects/mlegls-pi/issues/thread-registry-and-zmx-launch]] independent CLI first use, the committed fixture's `--help` returned an argument-validation stack trace. Its guide describes `external ROOT` as opening pi in a second terminal, but supplies no headless PTY recipe for the agent shell.

Running that entry under macOS `script` with the harness's socket stdin failed before reaching pi: `tcgetattr/ioctl: Operation not supported on socket`. A Python stdlib `pty.openpty` relay running the unchanged documented external/attach commands reached both surfaces; the owned relay and children were stopped afterwards. This observation belongs to mlegls-pi's fixture/setup tooling, not the thread registry launch contract. Consider printable help and an explicit PTY recipe. [Encounter](../attachments/thread-registry-and-zmx-launch/driver-log.md).
