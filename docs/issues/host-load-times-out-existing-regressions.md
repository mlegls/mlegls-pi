---
stage: done
assignee: agent
author: session:01a0f6bc-8c6b-7179-b390-af3b53e964e3
---
Done: full-suite runs stop failing on a loaded host from the per-test timeout alone, and concurrent full-suite runs on one host queue instead of piling up.

1. `bunfig.toml` `[test]` sets a suite-wide default timeout of 20 s (`timeout = 20000`). Tests with their own larger timeouts keep them; don't raise any that are already above 20 s.
2. `mise.toml` declares `[tasks.test]` running `heavy bun test` (`bin/heavy` takes one of the host-wide `sem --id heavy` slots, default 2, FIFO; it's on PATH at `~/.local/bin/heavy`). Arguments pass through, so `mise run test lib/thread` scopes it. If `heavy` isn't on PATH, the task says so and exits non-zero rather than running unqueued.
3. Agents use it: `skills/enabled/pi/mlegls-pi/SKILL.md` names `mise run test` for the full suite (a single-file `bun test <file>` stays fine unqueued), and `AGENTS.md` if it names a test command.

Verify: `mise run test` passes; two concurrent `mise run test` with `HEAVY_SLOTS=1` run one after the other.

Diagnosis (2026-10-14): timeouts hit different short tests each time (lifecycle `turn-end`, lifecycle `raw integrate`, earlier dispatch/prune/tracker), only in 200 s+ full runs while other workers ran suites; the same suite passes in 95 s on a quiet host, and 48 CPU spinners on 14 cores slowed `lib/thread/lifecycle.test.ts` only ~1.3×. The likely pressure is memory from concurrent test runs (235 MB free at load 55 in the first encounter), which queuing addresses; host-wide worker admission (removed with zmx) is deliberately not restored.

## Encounters

During [[projects/mlegls-pi/issues/archive/tree-sidebar-bridge-fixes]], default `bun test` timed out two dispatch tests, the real-host worktree-prune test and a tracker lifecycle test. The prune test timed out again in isolation. At that encounter `top` showed load 54.91/56.64/48.10, 24 running processes, 15 stuck, 2.27% idle CPU and 235 MB unused memory.

Rerunning with `--timeout 60000` passed all dispatch/tree tests and that lifecycle test. Another tracker test's explicit 30s timeout failed in the full run but passed alone in 20.4s with assertions unchanged. [Receipts](../attachments/tree-sidebar-bridge-fixes/regressions.txt). No product assertion failure was observed. The host admission gate has an existing owner: [[projects/mlegls-pi/issues/admit-workers-against-a-host-wide-budget]]. The exact share of the delays caused by host pressure is unmeasured.

Additional encounter during [[projects/mlegls-pi/issues/retry-tests-wait-for-real-backoff]] (2026-10-14, commit 9ceb54f7): default `bun test` ran 224 tests in 213.89s, with 221 pass, 2 skip and one 5s timeout in `lib/thread/lifecycle.test.ts`: `archive conflict answered turn-end is not a resolution: node and ancestor stay active`. The unchanged case passed immediately in isolation in 1.985s via `bun test lib/thread/lifecycle.test.ts -t 'archive conflict answered turn-end'`. No assertion failure observed; host load and the cause of the timeout were not measured. Timings and reproduction: [retry trial packet](../attachments/retry-tests-wait-for-real-backoff/index.md).

Independent driver encounter for retry-tests-wait-for-real-backoff at `9ba836be`: default `bun test` took 225.09s (221 pass, 2 skip, 1 fail, 1 error). `raw integrate follows ab-parent, refuses a dirty or unprepared source, lands beside unrelated destination edits, and leaves threads active` timed out at 5003ms with a SIGTERM git error. Immediate unchanged `bun test lib/thread/lifecycle.test.ts` passed all eight cases in 15.56s; that case took 1.619s. Cause/host load unmeasured; isolated rerun is the workaround, no timeout changes. [Independent packet](../attachments/retry-tests-wait-for-real-backoff/drive.md).

## Result

done

I reviewed the diff against the ticket. The change meets it, and I made one small docs fix.

- **Timeout:** `bunfig.toml` sets `timeout = 20000`. The diff doesn't touch any test with a larger timeout of its own.
- **Queued task:** `mise.toml` adds `[tasks.test]`, which runs `exec heavy bun test`. It exits 1 with a message if `heavy` isn't on PATH. I ran `mise run test lib/thread/lifecycle.test.ts` and it passed (8 tests, 13.7 s), so arguments pass through.
- **Agent guidance:** `skills/enabled/pi/mlegls-pi/SKILL.md` now names `mise run test` for the full suite and leaves `bun test <file>` for a single file. There is no `AGENTS.md` in the repo.
- **Fixed in review:** `README.md` still said `bun test` for the full suite. I changed it to `mise run test` (commit `a7951b52`).
- **Not re-run:** I did not repeat the full suite or the two-concurrent-run check. I'm relying on the driver's packet for both.

```yaml
commit: a7951b52
stories:
  - story: Full suite passes
    outcome: held
  - story: Concurrent single-slot full suites serialize
    outcome: held
  - story: Scoped arguments pass through
    outcome: held
  - story: Missing heavy fails clearly without running Bun
    outcome: held
  - story: Agent guidance names queued command
    outcome: held
  - story: Exact timeout configuration and preserved larger overrides
    outcome: held
evidence:
  path: docs/attachments/host-load-times-out-existing-regressions/drive-2.md
  visual: false
  shots: []
fixed:
  - README.md full-suite command now names `mise run test` (a7951b52)
caveats:
  - Every `mise run test` now waits for a free `heavy` slot, so a full run can start late when other workers hold the slots. This is the intended trade.
  - The timeout story was unobservable to the driver. I confirmed it by reading the diff.
```

Evidence: [docs/attachments/host-load-times-out-existing-regressions/drive-2.md](docs/attachments/host-load-times-out-existing-regressions/drive-2.md)
