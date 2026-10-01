---
stage: done
assignee: agent
author: session:01a0e86d-1938-73c6-a2bc-7972041dcc60
---

Obsolete 2026-10-01: the ab daemon and its `ab mail`/`ab service`/`ab check` commands were deleted in the pi 0.99 rebuild (`4b79baa`). Mail is the `mail` and `board_*` tools now; nothing replaces `ab service` or `ab check` yet.

During Concept's `deliver-declared-applet-commands-from-the-tutor` first use, a held scripted-provider fixture handled SIGTERM by restoring its Convex Settings and stopping its provider. `ab service stop <fixture>` returned before that cleanup finished. Immediately stopping the packaged host and backend in the same shell call made the fixture's cleanup query fail with ECONNRESET against its owned local backend. All processes stopped, but Settings still selected the now-stopped fixture model.

Workaround: keep the backend alive until the fixture confirms Settings restoration, then stop dependent services. The fixture now prints that completion; retained local Settings were repaired through the normal authenticated settings mutation. No changes to ab were made.

Consider making `service stop` wait for process exit (with a bounded kill deadline), or expose a wait-for-stopped operation and state explicitly that stop only initiates shutdown.
