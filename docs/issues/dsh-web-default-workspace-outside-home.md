---
stage: idea
assignee: agent
author: session:01a0e1a4-3d08-7254-a111-e7468d67a03e
part-of: "[[projects/mlegls-pi/issues/dsh-port]]"
---

During the earlier supervised attempt, a fresh worker-owned `DSH_HOME` selected
`/Users/mlegls/Documents/deepseek-harness/default-workspace`, outside both the
checkout and isolated home. Setting `DSH_HOME` and passing checkout-owned Cordis
overlays did not change this. The exact created file was removed; no other
workspace files were changed.

The triggering user turn said “Remember: the relay switch is labeled copper-moth.”
The model chose to persist it in `MEMORY.md` through `tools.write`; the path was not
specified by the user. This was ordinary model-driven file writing through the
Hashline preset, not an automatic memory contributor or the compaction provider.


Observed workaround: before a model turn, add a checkout-rooted workspace and
select it in Web or the dsh workspace registry. For the successful rerun, with Web
stopped, I added and selected a row in `dsh/.local/home/storages/workspace.json`;
Web displayed that workspace and the new session header's `cwd` matched the
checkout. This fixes the target for that encounter, not dsh's external default.
A supported launch-time owned-workspace option remains worth tracking.

The dispatch driver's fresh-home encounter also required stopping Web, registering the checkout with `dsh/add-workspace.ts`, and restarting with the probe patch. This is setup friction owned by the same launch-time workspace seam, not a dispatch failure. See [dispatch evidence](../attachments/dsh-templated-spawn-and-dispatch/index.md).
