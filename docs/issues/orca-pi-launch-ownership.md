---
stage: goal
assignee: agent
---

`lib/orca.ts:startPi` must launch Pi itself to select model/effort, then enroll the terminal through native `worker-start --terminal`. Orca 1.4.206 rejects `worker-start --agent pi --model …` before launch.

This splits lifecycle ownership: Orca settles the Dispatch but native release returns `retained / external_terminal`, so the coordinator must explicitly close the caller-owned terminal after integration. Direct native Pi launches release correctly. Prefer upstream Pi launch-preference support so the normal runtime-owned path covers routed workers too.

Accepted for the native-coordination trial; the full receipt and caller-owned terminal are exposed rather than hidden behind automatic cleanup. Observed in [verification](../research/orca-native-coordination-2026-09-21.md).
