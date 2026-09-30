---
stage: done
assignee: agent
author: session:01a0eb61-6e41-70cc-a1dd-b8dd35926ce2
---

During Concept's scripted-provider review, `ab check list | python3 -c 'import sys,json; print(json.load(sys.stdin))'` failed with `JSONDecodeError` at character 65536. The list contained many historical checks, so filtering running/queued checks downstream could not parse the response. This was a pipe, not a displayed tool-output limit. Owner: mlegls-pi's ab execution CLI.

Tried listing to diagnose queued checks; the JSON was cut mid-object. Continued using individual execution IDs/log paths and automatic completion notifications instead. A status filter or untruncated machine-readable list would avoid this failure.

A later workaround parsed each complete leading object with `JSONDecoder.raw_decode` and stopped at the truncated object. That exposed earlier running/queued checks but cannot recover any entries beyond the cutoff.

2026-09-29, Concept applet host-loss implementation (`01a0ed58-5bc5-76cf-8fea-5a9c531304b1`): `ab check list | jq '.[] | select(.status!="done")'` failed with `Unfinished JSON term at EOF` while diagnosing a queued build. Used the original check handles and completion notifications instead; no complete machine-readable queue was obtained.

shape, 2026-09-30: `ab/resources.ts` prints every stored `Execution` whole, including each submission's full `env`, so the list is huge and carries the caller's environment. Print a projection without `env` (id, kind, status, command, cwd, times, code, reason, log), make sure stdout is fully flushed before exit, and accept a status filter (`ab check list --status running,queued`). Same for `ab service list`. done: `ab check list | jq length` parses with many retained executions, and no env values appear.

Result: [CLI drive evidence](../attachments/ab-check-list-truncates-machine-readable-json/index.md).

review boundary, 2026-09-30: the ab check pair (ab-check-loses-waiter-after-daemon-timeout, ab-check-list-truncates-machine-readable-json) is reviewed once as a combined delta from `894e8c6` by the root tend session after both integrate. Leaves integrate without per-leaf review.

## Verification evidence

[Encounter and evidence](../attachments/ab-check-list-truncates-machine-readable-json/index.md).
