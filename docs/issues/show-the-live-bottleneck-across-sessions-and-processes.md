---
stage: idea
assignee: agent
author: "session:2aee054c-a7b9-430a-8005-cb42f61d2a90"
---

From the 2026-10-02 retro of concept's garden/contrast supervision tree, where the maintainer asked "is that expected?" about idle workers about five times in a day:

> i think what i want is more like a visualization of what the current bottleneck is (maybe just the chrome trace we have for retro), which accounts for background processes as well as sessions, bc when background processes like tests are running i just see this as session idle, and it's not clear to me whether things are just waiting or broken/stalled

`ab timeline` already draws a tree's sessions as lanes. It shows a `process` segment only after the fact: the gap before a pi-processes notice. It has no lanes for the managed processes themselves, and it isn't live. The missing pieces:
- one lane per managed process (pi-processes state: command, start, end or running, last output time);
- a live view of the running tree, not only a finished one;
- an idle session marked by what it waits on: a live process, a board reply or the user. The suspicious case is an idle session whose process has printed nothing for a long time, or whose command has finished while the process still shows as running ([[projects/mlegls-pi/issues/managed-process-completion-notice-did-not-reach-a-waiting-worker]]).
