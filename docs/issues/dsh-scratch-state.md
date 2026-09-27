---
stage: done
assignee: agent
author: session:01a0e1a4-3d08-7254-a111-e7468d67a03e
part-of: "[[projects/mlegls-pi/issues/dsh-port]]"
---

State that survives between PTC programs, kept outside PTC with a read/write interface: a host-side scratch service exposed as tools (get/put/delete/list by key, JSON values), scoped to the session. It replaces what the exec kernel's retained state gave: look, then refine without re-reading everything. Live objects stay in their own host services and appear here only as handle ids.

## Result

Scratch tools (`scratch_get`, `scratch_put`, `scratch_delete`, `scratch_list`) are
registered in the hashline PTC preset and store lossless JSON in host memory keyed
by the live Session object. A later `run_code` in the same live session can read
what an earlier program stored. Scratch state is intentionally memory-only: the
current `Session.append()` API cannot mark plugin events ignorable, and required
custom events would make older readers refuse a session. Values therefore do not
survive reload, restart, or plugin replacement; forks start empty. Revisit with a
session-sidecar backend or a compatible ignorable-event API if lineage persistence
becomes necessary.

[Supervised encounter evidence](../attachments/dsh-scratch-state/index.md).
Scratch tools (`scratch_get`, `scratch_put`, `scratch_delete`, `scratch_list`) are
registered in the hashline PTC preset and store lossless JSON in host memory keyed
by the live Session object. A later `run_code` in the same live session can read
what an earlier program stored. Scratch state is intentionally memory-only: the
current `Session.append()` API cannot mark plugin events ignorable, and required
custom events would make older readers refuse a session. Values therefore do not
survive reload, restart, or plugin replacement; forks start empty. Revisit with a
session-sidecar backend or a compatible ignorable-event API if lineage persistence
becomes necessary.

## First use

With the pinned dsh packages, two `ToolRuntime.execute` calls to `run_code` used
one agent/session. The first stored `{ rows: [2, 3, 5], total: 10 }`; the second
read and returned `10`. The actual dsh PTC dispatch bridge and scratch tools ran
with an inline test runtime; this was not a model-backed Web turn or a test of
the Node PTC process backend. An isolated anonymous-local Web server started,
but an unauthenticated HTTP probe returned 401; the process was stopped.

Done when one `run_code` stores an intermediate result and a later one reads it back in the same session. Check whether it should persist as session events (ignorable) so it survives reload and forks with lineage, or live only in memory; record the choice.
