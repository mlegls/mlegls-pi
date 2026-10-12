---
stage: "idea"
assignee: "agent"
author: "session:01a131ba-dc51-70d7-bdac-e7a7a8326e37"
priority: 3
---
Observed while refining Concept's release Query at worker base e9062b5833d92ff202ed30b7211758fec40529d1, after using the global tracker backend to create seven children. Owning tool/repository: mlegls-pi, skills/tracker/scripts/issues.ts (installed through ~/.pi/agent/skills/tracker).

`issues.ts check` reads issue contracts from Concept's canonical docs/issues but resolves their same-project attachment links through the invoking worker's docs. It reported the globally done lead-from-adopting-a-template-to-its-first-charting issue's index and independent-drive as nonexistent. Both files exist in /Users/mlegls/dev/mmon/concept/docs/attachments/lead-from-adopting-a-template-to-its-first-charting; they are absent from the older release-refinement worker checkout. This is a false missing-target report for a canonical issue, not a lost evidence packet.

Running check from the canonical Concept checkout removes those two diagnostics. It still reports genuinely unlanded packet links, including query-origin-backfill/index and query-from-patch-provenance/index from collector-side work; canonical results and branch-local evidence can be at different landing states. The seven new children validate structurally through `tree query-hub-releases-and-adoptions`, and none was named by the link diagnostic. Six unrelated already-done prerequisite edges were repaired through tracker fields separately; the global link check is not claimed green.

Located mechanism: checkLinks in issues.ts receives invocation-local docs plus canonical issuesDir, walks both, then projectRoot maps a matching Git-common-directory project to invocation-local docs. The earlier [[projects/mlegls-pi/issues/tracker-check-repairs-links-against-another-checkout]] intentionally made branch-local link checking authoritative, before issue operations became global. Reconcile that behavior with the global backend, rather than restore canonical fallback for every branch-local document and regress the earlier worktree behavior.

Workaround: validate the changed subtree through tree/snapshot, and check canonical issue citations from the canonical checkout while explicitly recognizing collector evidence still awaiting landing. Do not create empty attachments or rewrite valid peer citations to satisfy the worker check. A check invoked concurrently with tracker mutations once returned database is locked; it succeeded in running (with link diagnostics) after the mutations finished, so that transient was not treated as this defect.

Open choice: define the right link-resolution source for global issue contracts versus branch-local documents and pending collector evidence. A source-aware resolver appears preferable to one global docs root, but this observation does not authorize a new policy or assertion suite. No owner source was edited from the Concept refinement worker.
