---
stage: "done"
assignee: "agent:auto-routine"
priority: 1
author: "session:01a1cdb0-4d22-72bc-8778-94e6b358a046"
---
Every reconciler tick starts with `await locked(async () => recoverLandings(completion))` in [reconcile.ts](../../lib/reconcile/reconcile.ts). That lock (`<git-common-dir>/reconcile/integrate.lock`) is the one every run in the repository holds through a whole integration, `pre-integrate` checks included. So while one run lands, every other run in that repository stops at the top of its tick, even with nothing of its own to recover.

Observed 2026-11-21 in Concept, which runs ~10 reconcilers at once: `chat-lesson-briefly-closes-as-paused-after-success` and `admit-any-file-in-a-session` sat 10+ minutes after "started quietly" with empty chains, a `resume` record waiting to relaunch, no child processes and no log lines. The lock was held by `dependency-preparation-sits-silent-after-bun-install`, whose `mise run pre-integrate` (`bun run check && bun run test` behind `heavy`) runs for minutes. Landings queue back to back, and idle runs poll the lock once a second, so a run can lose that race for a long time. The Concept supervisor read it as a resume record that was never relaunched.

`recoverLandings` ([completion.ts](../../lib/reconcile/completion.ts)) only acts on this run's own `landingOps` that have no `landed` entry. With none, it needs no lock. Proposed repair: guard the call with `if (Object.values(s.landingOps).some(op => !s.landed[op.slug]))`. Also check whether any other per-tick step takes this lock without having integration work of its own.

## Done when

- While a run in the same repository holds the integrate lock (fixture: hold `integrate.lock` with a live pid), a run with no pending landing op still launches its next worker, including a `resume` relaunch.
- A run with a pending landing op still waits for the lock before recovering it.


## Result

done. Both workers launched under the held lock; only landing recovery waited for release. All 10 affected checks passed. The review changed only the evidence packet.

```yaml
commit: 2f7d6f53
stories:
  - story: A run without a pending landing launches its next worker while another run holds the lock.
    outcome: held
  - story: A stopped implementation relaunches from its saved head while another run holds the lock.
    outcome: held
  - story: A run with a pending landing waits for lock release before recovering it.
    outcome: held
evidence:
  path: docs/attachments/idle-reconciler-ticks-wait-on-another-runs-integration/index.md
  visual: false
  shots: []
tests: []
filed: []
caveats:
  - Post-landing PR publication still takes the integration lock to check whether a poll is due. Neither fresh nor resumed implementation launches enter that path.
```

Evidence: [docs/attachments/idle-reconciler-ticks-wait-on-another-runs-integration/index.md](../attachments/idle-reconciler-ticks-wait-on-another-runs-integration/index.md)
