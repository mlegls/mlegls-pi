---
stage: idea
assignee: agent
author: session:01a0f093-de63-7719-a347-69ed2ed8e034
---

The session-meta isolation [drive](../attachments/session-meta-tests-ignore-inherited-wm-parent-session/index.md) tried Pi RPC `get_state` and an offline `/help` prompt to inspect a saved metadata entry without a provider call. RPC announced a session path, but neither action persisted the file. The metadata claim remained unobservable in that drive.

Owner: mlegls-pi verification setup. This is not evidence of a Pi persistence defect: Pi buffers a new session until an assistant message. Review used the public `SessionManager` API with a seeded assistant turn and the extension's registered session-start handler, then inspected the resulting JSONL. That establishes persistence without testing a configured provider or the CLI's full extension loader.

Consider documenting a reusable zero-provider metadata drive setup so reviewers need not rediscover the persistence boundary. Observation and workaround above; no change to Pi's persistence policy is proposed.
