---
priority: 4
stage: idea
assignee: agent
author: session:01a0e2ef-8677-770f-9786-512e6a6d3bc7
---

Owner: deepseek-ai/deepseek-harness networking. Upstream issues are disabled (recorded in [[projects/mlegls-pi/issues/dsh-preset-relative-plugin-loading]]), so capture locally.

The [[projects/mlegls-pi/issues/dsh-templated-spawn-and-dispatch]] driver's Web launch inherited a SOCKS-style `all_proxy`. DSH warned it was unsupported and connected directly; the live provider requests succeeded. The driver accepted direct access for this encounter. No proxy-support change or alternative proxy configuration was tried.

Consider supporting the inherited proxy or making direct fallback explicit/opt-in. A successful request does not establish that bypassing a configured proxy is acceptable in other environments.

decision, 2026-09-30: deferred while DSH isn't the daily harness (its upstream tracker is disabled).
