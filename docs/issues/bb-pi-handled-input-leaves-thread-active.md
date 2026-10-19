---
stage: "idea"
assignee: "human"
author: "session:01a1525a-bcfa-7171-83e0-278baf31365a"
---
BB's Pi provider must settle a turn/start whose Pi prompt response has data.disposition: handled. Otherwise input interception saves the model request but leaves the thread active indefinitely.

Observed in session 01a1525a-bcfa-7171-83e0-278baf31365a while implementing [[projects/mlegls-pi/issues/drop-reconciler-worker-notices-in-a-bb-plugin]], after the maintainer approved replacing the plugin hook with a pi input handler. Owning tool/repository: get-bb/bb, Pi provider bridge shipped with desktop 0.46.1; Pi runtime 1.2.0. No BB source checkout was available in this repository, and editing signed app artifacts was not assumed authorized.

Trusted isolated fixture project proj_t7wceyz6q9, environment env_ndfpmcfzhc, parent thr_676spydr7f, child thr_76b2y4t59x. Seeded worker registry and reconciler-state provenance used a live setup PID; this was a real BB child completion with synthetic reconciler ownership, not a real reconciler execution. Parent initially completed at seq 20. Child completion produced client/turn/requested seq 21 with systemMessageKind child-completed. Pi's input handler returned handled (the helper evaluates true on the same state and input); no new user/assistant message was appended to Pi session pi_802b9c0f-b3fe-4447-be27-d0fb73c6a991 after the initial response. BB showed status active, queuedMessageCount 0, no turn/started, turn/completed or turn/failed after seq 21. bb thread wait --status idle --timeout 15 failed with Timed out waiting for thread thr_676spydr7f to reach status idle.

Pi's installed docs/rpc.md explicitly says a successful prompt response with disposition handled starts no run and clients must not wait for agent_settled. BB's provider-pi host bundle registers agent_settled forwarding (host.js lines 505–515) but has no disposition handling. The result is an interoperability gap, not permission to fabricate Pi lifecycle events or stop a live supervisor from its input handler.

Tried: load changed extensions/bb through a trusted project .pi/extensions shim; isolate XDG_STATE_HOME; seed ownership before releasing a scheduled child prompt; wait for child idle; inspect parent BB events, state and Pi session, then wait for parent idle. Manually stopping the disposable parent is cleanup only, not a functional workaround for a supervisor that may be doing real work.

Request: handle Pi's handled prompt disposition in the BB Pi provider and settle the pending BB submission without model work. The original system-hook coverage request remains [[projects/mlegls-pi/issues/installed-bb-bypasses-dispatch-hook-for-parent-system-notices]].
