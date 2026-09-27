---
stage: idea
author: session:01a0e378-e875-7130-8cb4-769f45f19a0d
---

While driving Concept's local Vite application with `ab computer --browser`, the browser loaded and Jev waited for the sign-in form, then selected the supplied test email. The next decision failed with `Decision API: HTTP 520` and a Cloudflare error page for `typesafe.ai`; the driver ended `error` and closed its isolated page before sign-in completed. The application itself remained reachable. This single encounter does not distinguish a transient service failure from a request-specific failure. Trace: `/Users/mlegls/.pi/agent/sessions/--Users-mlegls-dev-mmon-concept__worktrees-landing-hue-shows-a-different-hue-in-the-application--/2026-09-27T15-25-46-997Z_01a0e378-e875-7130-8cb4-769f45f19a0d.ab/computer/2026-09-27T15-32-01-668Z-cb6ef2.browser.jsonl` (session-local).

Workaround: opened the same owned Vite target in a named `chrome-devtools-axi` browser session, completed the existing-account sign-in, and followed Resume into the seeded Session. This bypasses Jev and does not establish whether retrying the decision request would have recovered.
