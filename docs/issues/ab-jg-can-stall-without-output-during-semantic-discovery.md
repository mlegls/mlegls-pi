---
stage: ticket
assignee: agent
author: "session:01a0ebd4-1dbc-708f-b2ad-c9569d585fdc"
---

`ab jg 'Mission poster frontier detail page frontier parity query navigation' packages/web/src` produced no output for 926 seconds in the Concept Mission-overview worktree on 2026-09-29. Its bash process was still present at cleanup; the caller terminated its owned process group with SIGTERM. No underlying cause was established.

The implementation continued with `ab grep` and bounded `ab read`, and completed without the semantic result. Investigate the stalled discovery path and whether a bounded timeout or progress report would make this failure cheaper. This observation is not evidence of an indexing or provider failure in particular.

Reproduced during [[projects/concept/issues/distinguish-retained-applet-openings-in-session-materials]] first-use preparation (session:01a0ed1b-d68b-70e8-9c35-09113e522bea): `ab jg 'applet_open tool input schema editing reopening material id' packages/web/src` returned no output before its caller group was terminated after 66 seconds. The subsequent service/build commands in that shell had not started. Exact grep and bounded reads located `convex/lib/application_tools.ts`; service/build were then run independently. This shorter observation does not establish whether the query would eventually return.

2026-09-29, Concept contrast-control implementation (`01a0ed1f-66f2-74d8-8b36-5d921d1e17a0`): `ab jg 'Where is Appearance panel and edition resolved on page load and ground changed?' packages/web/src` produced no output for over two minutes, delaying setup commands chained after discovery. Terminated only that query's owned child process; exact `ab grep` and bounded `ab read` found the sources. No cause established.

2026-09-29, Concept applet restart implementation (`01a0ed36-1a58-77ad-a960-37cc2d6cc3f0`): `ab jg 'What closes or rederives material surfaces when Session reconnects or branches change?' .` produced no discovery output for 699 seconds. Confirmed the original caller was still present, then terminated only its process group. Exact grep, bounded reads and the original drive's session record located the relevant paths. No underlying cause established.

2026-09-29, Concept edition consolidation (`01a0eeb2-107a-7696-873c-175434219389`): a font-preloading search over `.` and a cookie/schema search over `packages/web` produced no result before their caller groups were terminated after 278 and 131 seconds respectively. A prior narrower `packages/web/src` query completed in 38 seconds. Exact `ab grep`, imports and bounded reads completed the duplicate-code search; no cause established.

shape, 2026-09-30: callers need a prompt failure they can fall back from, not a diagnosis of the stall. `ab/jevgrep.ts` gives the `jg` child a wall-clock deadline (default 180s, `--deadline SECONDS`, 0 off); on expiry it kills the child, prints the completion line with elapsed time and `deadline`, suggests exact search, and exits 2 (incomplete). Also owns [[projects/mlegls-pi/issues/ab-jg-repository-wide-search-resource-limit]]'s want. done: a query against a stubbed hanging `jg` returns within the deadline with exit 2; `ab jg --help` documents it.
