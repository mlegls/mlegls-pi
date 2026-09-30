---
stage: done
assignee: agent
author: session:01a0e1a4-3d08-7254-a111-e7468d67a03e
part-of: "[[projects/mlegls-pi/issues/archive/dsh-port]]"
---

State that survives between PTC programs, kept outside PTC with a read/write interface: a host-side scratch service exposed as tools (get/put/delete/list by key, JSON values), scoped to the session. It replaces what the exec kernel's retained state gave: look, then refine without re-reading everything. Live objects stay in their own host services and appear here only as handle ids.

## Result

Scratch tools (`scratch_get`, `scratch_put`, `scratch_delete`, `scratch_list`) are
registered in the hashline PTC preset and store lossless JSON in host memory keyed
by the live Session object. A later `run_code` in the same live session can read
what an earlier program stored. Scratch state is intentionally memory-only: the
current `Session.append()` API cannot mark plugin events ignorable, and required
custom events would make older readers refuse a session. Values survive a browser
page reload while the session stays live, but not session restore after a process
restart, or plugin replacement; forks start empty. Revisit with a
session-sidecar backend or a compatible ignorable-event API if lineage persistence
becomes necessary.

[Supervised encounter evidence](../attachments/dsh-scratch-state/index.md).

## First use
A fresh model-backed Web encounter used the authenticated local login URL and two
separate `run_code` calls. The first stored `{ rows: [2, 3, 5], total: 10 }`;
the second returned it intact (`found: true`). The trajectory showed both
`tool/ptc-dispatch` entries and their nested `scratch_put` / `scratch_get` calls.

A browser page reload kept the live session's scratch value. After restarting the
Web service with the same `DSH_HOME`, reopening the saved session and reading the
key returned `found: false`. This matches memory-only storage; no scratch events
were persisted and forks need not inherit it. Screenshots and exact setup are in
the [encounter packet](../attachments/dsh-scratch-state/index.md).

Done when one `run_code` stores an intermediate result and a later one reads it back in the same session. Check whether it should persist as session events (ignorable) so it survives reload and forks with lineage, or live only in memory; record the choice.
