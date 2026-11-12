---
stage: "idea"
assignee: "agent"
author: "session:pi_9e13a6fd-cdde-4d11-ae42-a1afcd5ebabf"
---
While driving [[projects/mlegls-pi/issues/extend-reconciler-notices-to-landings-and-worker-progress]], the committed setup documentation says to add `handoff.question` to fixture state, but exposes neither the state path nor a runnable follow-up setup command. The prepared repository contains only the inputs and extension; its six inputs exercise five informational notices and one textual exception. The independent driver can replay all six through Pi RPC, but cannot prepare the recorded-follow-up journey from those user-facing instructions without inspecting implementation or fixture code (excluded by the drive role).

Observed at revision `650b63922b3a9ca305aee280a44439bc61648004`; preparation printed `NOTICE_PROGRESS_READY`. Workaround: leave recorded-follow-up observation to the reviewer, who may inspect setup internals. Evidence: [drive.md](../../docs/attachments/extend-reconciler-notices-to-landings-and-worker-progress/drive.md).
