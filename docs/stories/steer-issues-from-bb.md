---
persona: maintainer
kind: process
---

## Steer issues from bb

I rarely edit issues by hand; agents write them. What I want from a tracker is to see where every tree stands and put an agent on one from where I'm looking: hand a ready tree to a supervisor, or start a conversation to get unready issues to ready.

Issues page → pick the project → Tree (or Ready / Mine / Done / Archived) → open an issue to read it beside the list.

- A tree on the frontier → **Supervise** → a new supervisor or an existing one (the project's role holder or one started from here) → I land in that thread.
- An unready tree (still an idea, blocked, or claimed) → **Refine** starts a shaping session told why it isn't ready.
- **Discuss** opens BB's composer with the selected issue(s) mentioned; if all selected issues are on the frontier, **Supervise** takes them together.
- In any composer, `#` mentions an issue with its path, state, subtree and body.
- Threads working on an issue show it in the header (clicking opens it beside the chat); an issue's **Threads** list jumps to whoever is on it.
- With pickup enabled for a scope on the project's supervisor, any tree that becomes ready there starts a reconciler automatically once settled. Human-assigned, blocked, claimed, half-shaped, and explicitly stopped runs stay put. Batched starts fold into one notice turn.

The page watches the files live so agent writes appear without refresh.

Source: "can we make a linear-like tracker plugin for bb based on the .md tracker convention described in my skills? the most important affordances would be to send an issue tree to a new/existing supervisor, and to start a session with selected issues mentioned, to start a refinement discussion"; "i pretty much never manually process issues anyway. it's for read + agent action"; "the reconciler expects specs/tickets, so there should at least be a session to change the labels. i think an override would break things"; "blank, and there should be a quicker way to start on one issue (tree) too"; "the multiselect should also have the supervise affordance if it's all spec/ticket".

Source (pickup), 2026-10-22, @thread:thr_nt35tbjva9: "could this be automatic based on ticket status, as in a general supervisor directly picks up specs/tickets, so there's no push from shaping threads at all?"; "ok, let's file and start a session on the fixes in mlegls-pi then". Issue: [[projects/mlegls-pi/issues/pick-up-ready-work-from-the-tracker]].

Source (notice folding), 2026-10-25: "[reconcile ...] started notifications are queueing in individual bb turns rather than batched".

Source (thread links), 2026-11-12, after comparing with bb's Tasks plugin: "i think thread attachment is especially worth stealing in our plugin. it would be nice if i can easily click to the issue each thread is working on from the bb gui".

Implementation: `tracker/` in `~/dev/bb-plugins`; pickup in `lib/reconcile/pickup.ts`.
