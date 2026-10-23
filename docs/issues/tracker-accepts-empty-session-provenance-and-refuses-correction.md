---
stage: "idea"
assignee: "agent"
author: "session:01a1661a-bb76-7763-9c9f-43f21e4a4b41"
---
While refining Concept's `check-in-drive-setup-lacks-conversation-and-retry-scenarios` on 2026-10-23, a tracker create command launched through the managed `process` tool expanded `$PI_SESSION_ID` to empty. The same variable printed `01a1661a-bb76-7763-9c9f-43f21e4a4b41` in the `bash` tool earlier in this session. The environment difference's cause is not established; this observation alone does not establish that it shares the PATH issue in [[projects/mlegls-pi/issues/managed-process-nested-shell-loses-mise-python-path]].

`issues.ts create decide-diagnosed-retry-checkpoints-under-material-centered-lessons` accepted `author: session:` and committed it (`26e20a37` in Concept). A subsequent `issues.ts fields` showed that exact empty-suffix value. Trying `issues.ts update ... --fields '{"author":"session:01a1661a-bb76-7763-9c9f-43f21e4a4b41"}'` failed with `author provenance is immutable`. The incorrect field cannot be repaired through the documented adapter. This affects real captured provenance, not just command output.

Workaround: use literal captured session IDs in managed commands, and record the correct provenance in the issue body without editing canonical tracker files directly. The Concept goal body carries that correction. No tracker implementation was changed.

Possible improvement, not an agreed design: reject empty identity suffixes before committing, and provide a deliberate way to correct accidental malformed provenance without weakening normal immutability. Investigate why process and bash expose different session variables before choosing an environment fix.
