---
stage: ticket
assignee: agent
priority: 2
author: session:01a0f324-32e8-732c-96ad-132d2d15485e
part-of: "[[projects/mlegls-pi/issues/reconcile-the-execution-tree-with-lazy-exception-handlers]]"
---

Retargeted 2026-10-01: the ab daemon is deleted in the rebuild; the gate belongs to every reconciler and `dispatch` call instead. Its decision and trial evidence below still hold.

Concurrency is capped only per owner today, by each supervisor's judgment. On 2026-09-30 Concept's root supervisor held its own loops at 8. It did not count another session's three loops, the fold-kept sub-supervisor's ~14 fold-* tickets, interactive sessions, or each worker's services (Convex backend, application server, scripted provider, Playwright). Overnight, swap grew from 6 to 13 GB and load peaked near 15 on 14 cores. The tmux server then died with every worker in it ([[projects/mlegls-pi/issues/tmux-server-loss-interrupts-an-in-flight-verification-command]]). The maintainer's experience is that tight memory usually turns out to be tens to low hundreds of pi sessions and node processes.

Fix: one host-wide admission gate in front of every worker launch, across all owners and nested supervisors, the way GNU make's jobserver hands one token pool to recursive makes. A launch waits while live workers are at the cap, or while memory pressure is high (macOS `memory_pressure` free percentage, or swap used). With no central process, the token pool is a shared semaphore (file locks or a jobserver FIFO) on the host. A waiting launch shows as queued in the tree view, not as a failure. Count dev servers workers start against the same budget, or at least report them beside it.

Done when a second owner's launches queue behind the first's at the cap, and a launch under forced memory pressure waits and then proceeds when pressure falls.

Concept root supervisor (`mail/2d15485e`), 2026-10-01: about six browser workers is this host's observed practical limit. Dead workers' Convex-local backends, packaged Node servers and bash/node chains remained in their old worktrees until integration, about 630 MB per worker. With 8–10 GB swap this contributed to further check+test deaths (exit 137). Runs started before 0be483a. Stopping a dead handle's processes before relaunch fixes that leak, but does not replace host-wide admission across owners.


2026-10-02, from [[projects/mlegls-pi/issues/admit-heavy-checks-against-the-host-budget]]: heavy checks now take host-wide slots through `bin/heavy` over GNU parallel's `sem --id heavy` (FIFO, the caller's own process tree, dead holders reclaimed). A worker gate could be `sem --id workers` the same way. Sharing one pool with heavy checks would mean a worker holding a slot while its batch waits for another, so two ids is probably right; jobserver-style sharing works only if a worker hands its token to its batch.
