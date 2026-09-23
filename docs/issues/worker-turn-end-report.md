---
stage: done
assignee: agent
author: session:01a0cd1a-8da4-701c-8253-d1ab9fd2b4e6
part-of: "[[projects/mlegls-pi/issues/scripted-supervision-loop]]"
---

Workers report by ending the turn: the last message starts with `done`, `blocked` or `needs-input`, and may carry a fenced handoff block anywhere in it (commit, runnable setup, affected stories, caveats, question). A parser finds the sentinel and the block tolerantly (preamble, fences, trailing prose); a missing sentinel is itself an exception, not a guess. Questions end the turn with `needs-input` instead of a mid-turn `send`; the answer arrives as the next message.

Update the prompt pieces that still describe other channels: `agents/_common.md` (board topics and tags), `agents/verify.md` (`data: {held, failed, …}`), the Paseo reporting suffix in `lib/dispatch`/`lib/paseo`, and the `multi-agent` skill.

first use: parsing the last assistant text messages in the 2026-09-23 concept campaign (112 session logs under `~/.pi/agent/sessions/*0tlsrsf6*`) produced 77 `done`, 9 `blocked`, 1 `needs-input`, and 25 null statuses; no structured handoff blocks were present. The 25 missing sentinels remain explicit exceptions, never guessed.
