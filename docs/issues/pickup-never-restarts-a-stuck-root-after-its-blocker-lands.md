---
stage: "done"
assignee: "agent"
priority: 2
author: "session:thr_ivvhpy2bsb"
---
# Pickup never restarts a stuck root after its blocker lands

[[pickup-never-restarts-a-reopened-root]] made pickup restart a finished root whose issue changed after it finished. A root that finished `stuck` stays skipped even when what it was stuck on has since landed.

The concept reconciler for `joined-5000-profile-practice-and-map-stay-loading` finished "stopped with open work" at 2026-11-16 17:22Z (@thread:thr_ihbpyrp6s2#msg=37693); its blocker `shorten-compact-capture-and-first-bodies-in-fresh-practice` landed in the tree's collector at 17:22:35Z, the same minute. For the next 52 hours pickup skipped its priority-1 child ("ancestor … has reconciler state (stuck)"), and the daily reports' "For the supervisor" notes about it (@thread:thr_369c8pn5iw, @thread:thr_hftnnhh4e7) reached nobody, as in the 11-16 tag-chunk case. Found by the 2026-11-19 efficiency audit (@thread:thr_ivvhpy2bsb), which told the supervisor to restart it.

## tasks

1. Pickup treats a `stuck` root like a finished one: it restarts it when the root's subtree changed after it stopped (an issue edit, or a landing recorded into its collector after the stuck time).
2. The reconciler re-checks blockers after a landing in the same tick before deciding it is stuck.
3. Done when: a replay of the joined-5000 state (stuck at T, blocker landed at T+0.5s) is restarted by pickup, and a stuck root with nothing changed since stays skipped.

## Result

done — All four stories held. The same-tick replay caught a missed re-check: integrating the blocker marked the walk active even though it had already seen the held dependent. After repair, the dependent launched at the delivered commit in 2.12 seconds, with 60 seconds between ticks and pickup disabled.

```yaml
commit: dee897f4
stories:
  - story: Pickup restarts a stuck root after a subtree edit
    outcome: held
  - story: Pickup restarts a stuck root after a collector landing at T+0.5s
    outcome: held
  - story: Pickup skips an unchanged stuck root
    outcome: held
  - story: Reconciler re-checks blockers after a same-tick landing
    outcome: held
fixed:
  - d139badb re-checks held siblings when an active walk records a landing.
  - b7bcec8e prevents pickup from resuming a stuck ticket reassigned to a user or session, or left unassigned.
evidence:
  path: docs/attachments/pickup-never-restarts-a-stuck-root-after-its-blocker-lands/index.md
  visual: false
  shots: []
tests:
  - lib/reconcile/pickup.test.ts
  - lib/reconcile/scheduling.test.ts
  - lib/reconcile/collector-catch-up.test.ts
  - lib/reconcile/stop.test.ts
  - skills/enabled/all/mlegls/conventions/tracker/scripts/issues.test.ts
filed: []
caveats:
  - Runs predating finishedAt fall back to the state file's mtime. A later rewrite can obscure their original stop time.
  - Issue-edit detection uses local tracker file mtimes; the replay used the vault backend.
```

Evidence: [docs/attachments/pickup-never-restarts-a-stuck-root-after-its-blocker-lands/index.md](../attachments/pickup-never-restarts-a-stuck-root-after-its-blocker-lands/index.md)
