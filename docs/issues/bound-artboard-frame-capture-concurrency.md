---
stage: "done"
assignee: "agent"
priority: 3
author: "session:draw-session-map-and-graph-diff-node-marks-implement-1"
---
The artboard skill's `scripts/canvas.ts` captures every frame of a layout at once (`Promise.all` over all frames in one browser), each waiting at most 30s for `#storybook-root > *`.

Observed 2026-10-24 building a 22-frame page of Storybook frames from a concept worktree against its dev Storybook, with host load average ~50 (shared with other workers): the build threw `TimeoutError: waitForSelector: Timeout 30000ms exceeded` at canvas.ts:153 on every retry (five attempts, ~45s each), though the same stories rendered in under 10s when opened one at a time. A 12-frame page built fine minutes earlier. Stories warmed by opening them serially first did not help.

Workaround used: a copy of canvas.ts whose capture loop is a pool of 3 workers (`ARTBOARD_CONCURRENCY=3`); the 22 frames then built in 90s.

Proposal (not done): read `ARTBOARD_CONCURRENCY` (default: all, as now, or a modest 6) and run the capture as a bounded pool; also surface the failing frame's name in the timeout error (today only the stack names `capture`).

Merged in from [[projects/mlegls-pi/issues/artboard-canvas-capture-races-frame-selectors]] (closed into this one), whose observation was:

> The full Concept screens canvas doesn't build (2026-10-21): `bun ~/.pi/agent/skills/artboard/scripts/canvas.ts ../../docs/design/screens.json --out ../../.lavish/screens` from `~/dev/mmon/concept/packages/web` aborts with `No element matches .catalog-story-panel`, without naming the frame, on every run against a warm Storybook.
> Cause: the artboard captures every frame at once and waits a fixed 1.5s after `#storybook-root > *` appears (`canvas.ts` `capture`). With the canvas's ~80 frames loading together, 16 `.catalog-story-panel` frames hadn't rendered their panel by then; each renders it when loaded alone. Waiting for `frame.selector` (with a timeout that names the frame), or capping concurrency, would fix it.
> Transferred from concept's `screens-canvas-build-aborts-on-a-catalog-story-panel-frame` (author session:01a15e41-4711-73d2-b468-920ae9dd80e6). Related: the efficiency audit of 2026-10-22 (@thread:thr_nt35tbjva9) recommends the artboard builder check rendered frame geometry and named variants before delivery.

## shape

All in [canvas.ts](../../skills/enabled/all/mlegls/artboard/scripts/canvas.ts). `89ec0310` already caps capture at a fixed pool of 6, so what remains:

- the pool size reads `ARTBOARD_CONCURRENCY` (positive integer, default 6).
- `capture`: for a story frame, after `#storybook-root > *`, also `waitForSelector(frame.selector)` when one is set, instead of relying on the fixed 1.5s settle (the settle stays for animations).
- any failure inside `capture` (selector timeout, `No element matches …`) is rethrown as `<frame.name> (<story or file>): <message>`, so the build names the frame.

decisions:
- 2026-11-02: merge the selector race into this ticket and take it off deferral; both are capture's wait/concurrency (@thread:thr_dwre28wvm6).

## Result

done

I rebased onto `63a3f8b8` and the branch head is now `73941c20`. The only conflict was `skills/enabled/all/mlegls/artboard/SKILL.md`. I kept the new `host-for-human` step 4 from the base and my step 3 with the `ARTBOARD_CONCURRENCY` and named-capture-error wording.

The one-line SKILL.md conflict was the only change I made. After the rebase `canvas.ts` still parses (`bun build --no-bundle`), and I did not re-run any fixture builds. The `at` placement changes are already on the base, so the `canvas.ts` diff against it is now just the concurrency, selector and error changes.

```yaml
commit: 73941c20
stories:
  - story: Capture concurrency is configurable, with default 6
    outcome: held
  - story: Story captures wait for their configured selector
    outcome: held
  - story: Capture errors identify the frame and story or file
    outcome: held
  - story: Invalid concurrency is rejected
    outcome: held
evidence:
  path: docs/attachments/bound-artboard-frame-capture-concurrency/index.md
  visual: false
  shots: []
fixed:
  - "artboard SKILL.md now documents ARTBOARD_CONCURRENCY and named capture errors, commit e9159a5b"
caveats:
  - "The driver used a mocked Storybook fixture, not the historical shared-host overload."
  - "Batch timing supports bounded scheduling, but simultaneous page counts were not instrumented."
  - "The default pool of 6 trades some speed on idle hosts for stability on loaded ones. The driver measured 5.4 s unset against 7.7 s at 3 for 8 delayed frames on the fixture."
```

Evidence: [docs/attachments/bound-artboard-frame-capture-concurrency/index.md](../attachments/bound-artboard-frame-capture-concurrency/index.md)
