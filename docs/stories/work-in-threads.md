---
persona: maintainer
kind: process
---

## Work in threads

I run dozens of agent threads across projects, most of them nobody is watching. I want to see them as the two trees they form (who spawned whom, and what merges into what), start, fork, merge, archive or abandon any of them from where I'm pointing, and look at one without the others dying when the window closes.

Point at a row → see its actions → new / fork / archive → the main pane shows that thread → close the window → everything is still running.

Scrolling the sidebar never opens anything. Archiving a thread closes what it spawned and merges its children into it, then it into its parent; a conflict goes back to the agent that made it.

When I already have a worktree, I can add it from Threads without creating another checkout. Project’s + dropdown → Add Existing Worktree… → choose its folder → open its existing interactive thread, or start one there as a guest. Closing or abandoning that guest leaves the worktree and branch intact.

When I just need a shell or a quick pi that isn't a thread, I open it in Threads instead of a separate terminal. ⌘N → a workspace under Scratchpad in ~ → tabs and splits as anywhere else → close its last pane and it's gone. A bell in one I'm not looking at marks its row.

With several projects open, I can drag their headers into the order I want. The order survives refreshes, view switches and restarting Threads; new projects appear after the ones I've arranged. Scratchpad stays first. Rearranging projects doesn't change thread parentage or open a different session.

When I have several terminal tabs, each has the same width regardless of its title. Title changes don't move the targets.

Source: "let's make terminal tabs have an even width rather than being only as wide as the title"; "let's make it possible to rearrange projects in the Threads sidebar"; "let's add a \"scratchpad\" pseudo-project to Threads, where i can spawn pi sessions and terminal tabs that aren't actually threads, so i don't have to open a separate terminal"; "let's add a way in the Threads app to add a specific worktree (attaching to existing) as a thread"; "let's put it as a dropdown with the + button on a project"; "i often accidentally scroll through the sidebar and accidentally open a bunch of closed sessions i meant to just 'hover' on"; "i'll have 10s of non-interactive sessions and they can't be tabs".

Issues: [[projects/mlegls-pi/issues/threads-on-zmx-with-a-native-sidebar]].

Guide: [[projects/mlegls-pi/guide/work-in-threads]].
Existing-worktree self-check observed the native chooser and checked guest creation, reuse and checkout-preserving abandonment through the CLI. [Evidence](../attachments/add-existing-worktree/index.md); full native selection remains with [[projects/mlegls-pi/issues/cua-cannot-address-threads-worktree-chooser]].
Implementation first use covered both trees, hover actions, non-opening wheel/j/k, new/worktree/fork, merge/archive/abandon and keeping the parent when abandoning its children. Native Ghostty showed one main client switching between threads; closing the owned window left all four fixture agents running. [Packet and setup](../attachments/tree-sidebar-over-threads/index.md). Independent driving/review remains; conflict routing uses the independently driven [core lifecycle](../attachments/thread-core-and-workers-on-zmx/index.md).
Independent native driving observed both trees, j/Enter switching to a seeded child, and all four agents surviving window closure. Scoped native input could not reach hover, so review re-drove hover, new/worktree/fork, cancel and confirm of merge/archive/abandon, abandon-all-children and conflict routing through the real sidebar and zmx on a private pty; it also fixed the sidebar ignoring thread switches while a merge waited on a conflict. [Independent packet and review](../attachments/tree-sidebar-over-threads/independent-drive.md). Pixel input in native Ghostty remains with [[projects/mlegls-pi/issues/cua-ghostty-pixel-click-lands-on-another-row]].

The sidebar guards zmx's missing/other-window leader case; a concurrent disconnect race remains with [[projects/mlegls-pi/issues/zmx-switch-without-a-leader-kills-the-source]].
