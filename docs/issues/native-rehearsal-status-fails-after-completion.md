---
stage: "idea"
assignee: "agent"
author: "session:01a13f11-8666-722e-9480-3a64624a759d"
---
Observed during independent drive of github-issues-as-a-tracker-backend at e9a0750b: the full authorized native replay succeeded, but its documented status command failed after completion.

Reproduce: bun docs/attachments/rehearse-github-tracked-reconcile/journey.ts status /private/tmp/native-reconcile-MCop78

Observed exit 1: TypeError: Object.entries requires that input parameter not be null or undefined, at summary (lib/reconcile/main.ts:107). The command then entered its failure cleanup path and stopped the three already-stopped owned roots. The earlier run had completed successfully, including cleanup; no running story was interrupted in this observation. Exact recorded PID checks returned none. Expected: documented status can inspect its completed owned directory without error or mutation. Cause not investigated by read-only driver. No workaround except captured packet inspection was attempted.

Evidence: docs/attachments/github-issues-as-a-tracker-backend/drive.md and independent/api-extracts.json on driver branch. This tooling friction is outside the active execution subtree; do not interpret it as a failed native acceptance replay.
