---
stage: ticket
assignee: agent
author: session:01a0e1a4-3d08-7254-a111-e7468d67a03e
part-of: "[[projects/mlegls-pi/issues/dsh-port]]"
blocked-by: ["[[projects/mlegls-pi/issues/dsh-hashline-tools-spike]]"]
---

State that survives between PTC programs, kept outside PTC with a read/write interface: a host-side scratch service exposed as tools (get/put/delete/list by key, JSON values), scoped to the session. It replaces what the exec kernel's retained state gave: look, then refine without re-reading everything. Live objects stay in their own host services and appear here only as handle ids.

Done when one `run_code` stores an intermediate result and a later one reads it back in the same session. Check whether it should persist as session events (ignorable) so it survives reload and forks with lineage, or live only in memory; record the choice.
