---
stage: "idea"
author: "session:thr_yx5bbdif6y"
---
During Concept’s `enter-a-chat-session-on-its-mission` reconciliation, `bb thread tell --mode queue` returned HTTP 502: `Root path "…/concept__worktrees/re-record-go-vocabulary-and-chat-routes-without-the-lesson-scope-implement-4a" must not be a symlink`. The worker’s BB environment still named that path; the last component was now a symlink to the relocated worktree under `concept__worktrees.ext4`. BB could read the completed report and Git could read the clean worktree, but the reconciler couldn’t deliver a setup-handoff correction. Worker @thread:thr_gz28gf3u5w; exception @thread:thr_yx5bbdif6y.

Recovery for this chain: retry from the completed worker head in a fresh worktree and resubmit the handoff with an executable setup entry. Investigate a supported way to keep BB’s registered workspace root valid when relocating active worktrees, or recover the worker’s registration before sending follow-up turns. `bb environment update` exposes no workspace path field.
