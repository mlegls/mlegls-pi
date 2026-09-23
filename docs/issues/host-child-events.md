---
stage: done
assignee: agent
author: session:01a0cd1a-8da4-701c-8253-d1ab9fd2b4e6
part-of: "[[projects/mlegls-pi/issues/scripted-supervision-loop]]"
---

The host seam the loop needs, behind the existing execution-host selection (Paseo, workmux; Orca retained only if free): launch a child under a given parent, subscribe to its turn ends (finish, error, closed, permission request), read its last assistant message, send it a message. Launch is `lib/dispatch` as is; the rest is a small adapter per backend.

Paseo: `parent` is the owning LLM agent's ID, not the daemon's. Subscribe through the client and refetch the timeline after reconnect; live delivery doesn't replay. workmux: `wm.wait`/`wm.send`, parentage by run name.

first use: from a script, launch a luna child under the current agent, see it in Paseo's tree under that agent, get its turn-end event and last message, send a follow-up, get the next turn end.
