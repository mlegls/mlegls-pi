---
stage: ticket
assignee: agent
priority: 2
author: session:01a0f324-32e8-732c-96ad-132d2d15485e
---

Owner: the ab daemon, which already starts every `ab supervise` worker. Concurrency is capped only per owner today, by each supervisor's judgment. On 2026-09-30 Concept's root supervisor held its own loops at 8. It did not count another session's three loops, the fold-kept sub-supervisor's ~14 fold-* tickets, interactive sessions, or each worker's services (Convex backend, application server, scripted provider, Playwright). Overnight, swap grew from 6 to 13 GB and load peaked near 15 on 14 cores. The tmux server then died with every worker in it ([[projects/mlegls-pi/issues/tmux-server-loss-interrupts-an-in-flight-verification-command]]). The maintainer's experience is that tight memory usually turns out to be tens to low hundreds of pi sessions and node processes.

Fix: one daemon-wide admission gate in front of every worker launch, across all owners and nested supervisors, the way GNU make's jobserver hands one token pool to recursive makes. A launch waits while live workers are at the cap, or while memory pressure is high (macOS `memory_pressure` free percentage, or swap used). A waiting launch shows as queued in `ab supervise status`, not as a failure. Count `ab service` processes against the same budget, or at least report them beside it.

Done when a second owner's launches queue behind the first's at the cap, and a launch under forced memory pressure waits and then proceeds when pressure falls.
