---
stage: "done"
assignee: "agent"
priority: 2
author: "thread:thr_879y94y97m"
---
A bash call given a millisecond-looking `timeout` blocked the last review of Concept's `make-large-card-imports-scale-in-one-tutor-script` tree for 16h 40m. Found by the efficiency audit of 2026-11-12 (@thread:thr_879y94y97m, both auditors independently).

@thread:thr_mjg3wfmkct#msg=1983 ran `mise run convex -- logs --history 400 … | tail -15` through `bash` with `timeout: 60000`. bash's `timeout` is in seconds (codemode's options line takes `timeout_ms`); `convex logs` streams forever, so `tail` never saw EOF and the call ended 60,000 s later at #msg=1987 ("timed out after 60000 seconds"). The review cost $10 and held the tree's landing from 11-10 22:32Z to 11-11 15:12Z. Nothing flagged it: the stall alarm only covers `waiting` workers.

The unit confusion is common: 256–277 bash calls across ~43 sessions in 11-09..11-12 passed `timeout` ≥ 3600, mostly 10000/60000-shaped.

## tasks
1. In [extensions/guard/index.ts](../../extensions/guard/index.ts)'s `tool_call` handler, block `bash` with `timeout` above a ceiling (around 1800 s, the process tool's own wait limit) with a reason that names the unit and the conversion ("bash timeout is in seconds: 60000 s is 16.7 h; slow or streaming work goes through the process tool"). Confirm it also sees bash calls nested in codemode.
2. A test beside the guard's existing ones.

Done when: a bash call with `timeout: 60000` is refused with that reason, directly and inside codemode, and `timeout: 600` passes.

## Result

done. I found no defects and made no code repairs.

- **Guard:** the check in `extensions/guard/index.ts` refuses a bash `timeout` above 1800 s and names the unit and the conversion. The same `tool_call` hook sees calls nested in codemode.
- **Test:** `bun test extensions/guard` passes, 2 tests, and the new case covers both direct and nested calls at 60000, 600 and 1800.
- **Frictions:** the one the driver added is evidence on the existing issue `mail-drive-handoff-names-only-a-test-runner`. Nothing new to settle.
- **Packet:** I appended a review section to the driver's packet and committed it as `f27263a4`.

```yaml
commit: f27263a4
stories:
  - story: Direct bash timeout 60000 is refused with unit and conversion guidance
    outcome: held
  - story: Bash timeout 60000 nested inside codemode is refused
    outcome: held
  - story: Bash timeout 600 passes directly and inside codemode
    outcome: held
evidence:
  path: docs/attachments/bash-timeout-read-as-milliseconds-blocks-a-worker-for-hours/index.md
  visual: false
  shots: []
tests:
  - extensions/guard/index.test.ts
```

Evidence: [docs/attachments/bash-timeout-read-as-milliseconds-blocks-a-worker-for-hours/index.md](../attachments/bash-timeout-read-as-milliseconds-blocks-a-worker-for-hours/index.md)
