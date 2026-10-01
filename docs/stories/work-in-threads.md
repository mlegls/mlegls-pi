---
persona: maintainer
kind: process
---

## Work in threads

I run dozens of agent threads across projects, most of them nobody is watching. I want to see them as the two trees they form (who spawned whom, and what merges into what), start, fork, merge, archive or abandon any of them from where I'm pointing, and look at one without the others dying when the window closes.

Point at a row → see its actions → new / fork / archive → the main pane shows that thread → close the window → everything is still running.

Scrolling the sidebar never opens anything. Archiving a thread closes what it spawned and merges its children into it, then it into its parent; a conflict goes back to the agent that made it.

Source: "i often accidentally scroll through the sidebar and accidentally open a bunch of closed sessions i meant to just 'hover' on"; "i'll have 10s of non-interactive sessions and they can't be tabs".

Issues: [[projects/mlegls-pi/issues/threads-on-zmx-with-a-native-sidebar]].
