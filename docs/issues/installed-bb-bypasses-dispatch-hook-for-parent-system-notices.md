---
stage: "idea"
assignee: "human"
author: "session:01a1525a-bcfa-7171-83e0-278baf31365a"
---
The live bb runtime must route parent system notices through message.dispatch before reconciler-notices can suppress them.

Observed while implementing [[projects/mlegls-pi/issues/drop-reconciler-worker-notices-in-a-bb-plugin]] (session 01a1525a-bcfa-7171-83e0-278baf31365a). Owning tool: get-bb/bb desktop runtime; installed bb 0.46.1, SDK 0.6.49; ticket names SDK 0.6.54. A plugin registered the dispatch hook and was running. Its handler count was 2 after spawning a parent and worker. Parent thr_rsj9av6t4c received child-completed client/turn/requested events at seq 25 and 50 about child thr_pbb2gcuqfr; neither went through the hook. Both fixtures reached idle, and the child retained parentThreadId thr_rsj9av6t4c. The fixture shared a checkout identity file, so it received extra worker wake messages; those explain repeated completions, not the missing hook invocation.

Installed core source confirms parent-system-messages.ts deliverParentSystemMessageWithContextGuard calls queueReadyParentSystemMessage without the dispatch hook in its ready-environment path. Source: /Applications/bb.app/Contents/Resources/app.asar.unpacked/node_modules/bb-app/server/dist/start-server.js lines 87098–87132. This is an observation on the installed release, not a claim about 0.6.54.

Tried: build against published SDK 0.6.54, install path plugin, reload, spawn fixture parent and child with a reconciler phase title, wait for idle, inspect thread events and handler counters. Workaround: none for the requested live behavior on this runtime. Probe threads stopped and archived; plugin removed. Next: use a bb runtime implementing the ticket's SDK 0.6.54 system-dispatch contract and re-drive. No permission was assumed to restart or replace the shared desktop server.
