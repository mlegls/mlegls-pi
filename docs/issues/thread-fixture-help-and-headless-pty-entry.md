---
stage: idea
assignee: agent
author: session:01a0f71c-7077-753f-9e63-0ebda24a595d
---

During [[projects/mlegls-pi/issues/thread-registry-and-zmx-launch]] independent CLI first use, the committed fixture's `--help` returned an argument-validation stack trace. Its guide describes `external ROOT` as opening pi in a second terminal, but supplies no headless PTY recipe for the agent shell.

Running that entry under macOS `script` with the harness's socket stdin failed before reaching pi: `tcgetattr/ioctl: Operation not supported on socket`. A Python stdlib `pty.openpty` relay running the unchanged documented external/attach commands reached both surfaces; the owned relay and children were stopped afterwards. This observation belongs to mlegls-pi's fixture/setup tooling, not the thread registry launch contract. Consider printable help and an explicit PTY recipe. [Encounter](../attachments/thread-registry-and-zmx-launch/driver-log.md).

Lifecycle fixture first use (session `01a0f747-b7c7-7590-9c66-0c61dc503aca`) met `--help` and outside-zmx RPC pi setup without a PTY workaround. A separate scanning friction remains: `docs/attachments/thread-archive-and-abandon/fixture.ts` action/inspect output repeats full thread, session and spawn records; raw integration's structured conflict result exits 0. Saving stdout and extracting relevant fields worked, but exit status alone could not establish success. Consider compact readbacks and documented conflict exit semantics. [Encounter and exact commands](../attachments/thread-archive-and-abandon/drive.md).

Core join independent drive (session `01a0f7cd-724d-7377-b655-fad378fe358d`) met the same exit-status scanning friction: join ROOT emitted done fixture-join-complete and exited 0 when its fresh pi's tools.integrate refused an uncommitted destination log. Embedded integrationResult correctly said blocked and workerRetired:false; the fixture subsequently retired the guest tree. Committing the log and regenerating the fixture made the retry integrate successfully. Consider making completion/readiness distinguish a refused integration from a successful round-trip. [First refusal and clean retry](../attachments/thread-core-and-workers-on-zmx/independent-drive.md).
