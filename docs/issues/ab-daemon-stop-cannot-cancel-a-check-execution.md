---
stage: done
assignee: agent
author: "session:01a0eea2-b2b2-7667-b178-6db7ab82f57e"
---

Owner: mlegls-pi `ab check` / execution lifecycle. In the Concept transfer review, a running `ab check -- bun test` returned execution ID `e88b4135-7aed-47b3-93a0-bbc4020a7cfa`. After its output stalled, `ab daemon stop e88b4135-7aed-47b3-93a0-bbc4020a7cfa` returned `unknown job`. `ab check --help` describes cancellation but exposes no cancel command; `ab daemon --help` advertises `stop <id>` for running jobs.

Workaround: verified the owned `bun test` PID/process group with `ps`, then terminated that process group directly. Clarify the distinction between check execution and daemon job IDs or provide an execution cancellation entry point. No claim that the job daemon itself malfunctioned.

result, 2026-09-30: cancellation is by design the waiter's departure (30s without waiters cancels the execution); `ab check --help` now says to stop the waiting caller and that execution IDs are not `ab daemon` job IDs. No separate cancel command.
