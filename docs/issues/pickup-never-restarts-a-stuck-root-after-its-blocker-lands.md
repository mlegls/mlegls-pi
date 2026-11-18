---
stage: "ticket"
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
