# Tool-call stall warning: drive

## Predictions before use

- A worker in a single 50-minute bash call without a running managed process should produce one `tool call stalled` exception, naming the tool and command. Repeating reconciliation should not duplicate it.
- A worker with a running managed process should produce no tool-call stall exception.
- A younger tool call should produce no exception. Telemetry should distinguish active calls from completed calls.

## Prepared encounter

Tested revision: `413885ba36c29bdea920bbb0745799d33181c548`.
Deployment: local reconciler fixture in this worker-owned checkout. No credentials or model required. Setup handoff specifies isolated temporary tracker, fake BB threads and an aged live-tool record. Entry point: `bun test lib/reconcile/exceptions.test.ts lib/session-meta/index.test.ts`. No browser or shared deployment involved. This encounter uses the supplied fixture runner; it does not observe a real 50-minute wall-clock stall or a live supervisor notification. Fresh sessions are required to activate telemetry, per setup handoff.

## Session log and outcomes

Predictions were recorded before running the supplied entry point. On 2026-11-12 it completed in 13.52 seconds, exit 0: **18 pass, 0 fail, 52 expectations** across two files. Readiness was established by this completed local fixture run. No source, test bodies or fixtures were inspected.

The runner reports two passing cases named `a 50-minute bash call with managed process=%s`. Under the supplied setup contract these correspond to the required unmanaged and managed-process stories. Both held at the supplied fixture surface. The output does not expose the exception payload or deduplication count, so those details rest on the fixture's assertions rather than an independently observed supervisor message.

Session metadata cases also passed. Their displayed names concern provenance and identity; they do not independently demonstrate tool-start/tool-end telemetry. The additional prediction about a younger call and completed telemetry remains unassessed by this encounter; it is not an additional ticket requirement.

## Expectations and frictions

- Required unmanaged and managed-process predictions: met at the supplied fixture-runner surface.
- Exception tool/command wording and exactly-once delivery: runner succeeds, but does not print these details for direct inspection. Reviewer should check its assertions against the ticket.
- Friction: both managed-process variants display literal `%s`, obscuring which result is which. This did not impede running the entry point; no product failure observed.
- The runner prints `integration of fixture failed (1), sent back: Missing or external evidence: docs/attachments/x.md` while its enclosing case passes. This appears to be an exercised rejection path, not setup failure: the overall command exits successfully.

## Replayable checks

1. In this checkout at the tested revision, run `bun test lib/reconcile/exceptions.test.ts lib/session-meta/index.test.ts`. Accept a successful exit, both 50-minute cases passing, and 18 passing cases overall.
2. Reviewer: confirm the unmanaged variant checks one exception after repeated reconciliation, including tool and command; confirm the managed variant checks none. These are the precise required observations that compact runner output cannot show separately.

No rendered journey; no screenshots. No services or external resources started. Only the completed fixture process was owned by this drive.
