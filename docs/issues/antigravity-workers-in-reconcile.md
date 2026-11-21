---
stage: "ticket"
assignee: "agent:auto-routine"
author: "session:01a1fc85-32d0-7768-9382-3e18c7628a80"
part-of: "[[projects/mlegls-pi/issues/lift-supervision-into-a-bb-plugin]]"
blocked-by:
  - "[[projects/mlegls-pi/issues/spawn-workers-on-any-bb-provider]]"
  - "[[projects/mlegls-pi/issues/check-worker-rules-at-integration]]"
  - "human: agy signed in and acp-antigravity added on the Beelink"
---
A reconciled ticket runs on Gemini 4 Neon through Antigravity's own `agy`, as a bb ACP worker. Tracer for [[projects/mlegls-pi/issues/lift-supervision-into-a-bb-plugin]].

Setup (maintainer): install `agy` on the Beelink, sign in once, and add `antigravity-acp` to bb (`bb acp add antigravity-acp`; it's listed `manual install`, so a custom agent pointing at `agy acp` if that doesn't wire up). Then `bb provider models acp-antigravity` names the model id.

Add `acp-antigravity/<gemini 4 neon id>:<effort>` to [auto-routine.md](../../agents/auto-routine.md)'s list ahead of the others and an `acp-antigravity` entry in [allocation.json](../../allocation.json), then reconcile one small `auto-routine` ticket end to end. Note in the result how Gemini handled the role prompt, the report format and tracker CLI use, and whether agy reads `.agents/skills` and `AGENTS.md`; frictions go in the tracker. Revert the list change after the run unless the maintainer keeps it.

Done when: the ticket goes implement → drive → review → integrate with at least the implement worker on `acp-antigravity`, and lands.
