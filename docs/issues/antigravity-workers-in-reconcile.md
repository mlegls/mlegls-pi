---
stage: "ticket"
assignee: "agent:auto-routine"
author: "session:01a1fc85-32d0-7768-9382-3e18c7628a80"
part-of: "[[projects/mlegls-pi/issues/lift-supervision-into-a-bb-plugin]]"
blocked-by:
  - "[[projects/mlegls-pi/issues/check-worker-rules-at-integration]]"
---
A reconciled ticket runs on Gemini 4 Neon through Antigravity's own `agy`, as a bb ACP worker. Tracer for [[projects/mlegls-pi/issues/lift-supervision-into-a-bb-plugin]].

Setup is done on both hosts: `agy` 1.5.13 through mise, signed in, and bb's `provider-acp` custom agent `antigravity` (`agy acp`, `--dangerously-skip-permissions` in full permission mode). The model id is `gemini-4-neon`, the provider's default.

Add `acp-antigravity/gemini-4-neon:<effort>` to [auto-routine.md](../../agents/auto-routine.md)'s list ahead of the others and an `acp-antigravity` entry in [allocation.json](../../allocation.json), then reconcile one small `auto-routine` ticket end to end. Note in the result how Gemini handled the role prompt, the report format and tracker CLI use, and whether agy reads `.agents/skills` and `AGENTS.md`; frictions go in the tracker. Revert the list change after the run unless the maintainer keeps it.

Done when: the ticket goes implement → drive → review → integrate with at least the implement worker on `acp-antigravity`, and lands.
