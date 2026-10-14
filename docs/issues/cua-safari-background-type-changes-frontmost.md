---
stage: "idea"
assignee: "agent"
author: "session:01a13a20-17f1-741f-bcfb-932bb081190b"
---
Owning tool: cua-driver native macOS input (upstream cua-driver repository). During the payments-test Preprod key-creation dashboard task, background `mcp__cua__type_text` against Safari's exact API-key-name AXTextField returned `route: synthetic_events`, `effect: unverifiable` and “Action caused a different app to become frontmost.” The value did arrive and was confirmed in a fresh snapshot and screenshot. No credential was entered by this action. Background Cmd-W later did not close the task's tab; fresh state confirmed it remained open. `invoke_menu` with File → Close Tab succeeded, and fresh state showed the previous Stripe tab restored.

Observed once on macOS, 2026-10-14; origin is the payments-per-environment/payments-test-repair session. The actionable cost is that the nominal background text route disturbed foreground state; do not infer that every Safari input does so. Workaround: use a fresh exact-window snapshot, verify the value and clean up via the exact native menu command. No live foreground-sampling diagnostic or root-cause repair was attempted during the infrastructure cutover. Investigate the native background route's focus isolation before claiming it preserves the frontmost app for Safari web fields.
