# Recent session friction triage — 2026-09-21

Scope: local Pi session JSONL modified since September 18, with reports dated September 18–21; compared against archived issues, current code, and September 21 verification notes. Keyword-led review of user/assistant reports and selected original tool calls, not an exhaustive error census. Disposable session-preparation fixtures, repeated transcript copies, and application-specific frictions are excluded. No live workers were interrupted or repaired.

## Actionable

| Priority | Finding | Disposition |
| --- | --- | --- |
| 1 | Five of seven routed workers selected a credit-exhausted OpenAI account; coordinator recreated them on ZAI. | New [routing availability issue](../issues/routing-known-provider-failures.md). Current route accepts caller usage, but has no provider-failure memory; unknown telemetry remains eligible. Pool quota and hard account unavailability are different inputs. |
| 2 | Coordinator reports stop → stop_unknown → release refusal directing it back to stop; abandon was the escape. | New [recovery investigation](../issues/orca-stop-unknown-recovery.md). Not reproduced here; previous audit exercised operator-close/already-settled recovery, not this state. |
| 3 | find([glob,...]) throws a Node path.isAbsolute argument TypeError. | Reproduced in this session. New [argument diagnostic issue](../issues/exec-find-argument-diagnostic.md). Unsupported input, poor diagnostic—not a broken supported glob operation. |

## Exec dispositions

- **jq backslashes: caller overescaping, not raw-mode data loss.** Original lint session line 141 supplies two literal backslashes before jq interpolation inside sh.raw; line 142 echoes the same doubled backslashes in jq's syntax error. A live probe with one backslash before each interpolation returned ok:7. Do not “fix” raw by unescaping it. The README already documents raw preservation; a short jq example is a possible documentation improvement, not a new API requirement.
- **Nested backticks, dollar interpolation, reserved bindings, selection-row shape:** handled by [exec-payload-quoting](../issues/archive/exec-payload-quoting.md). Later vault workers confirm object-form edit/write works; nested JSON/TS/shell still requires encoding each language boundary. rows is an array; use rows.length. Top-level imports and namespace collisions are not grounds to change cell lifetime semantics.
- **Hunk headers silently written into files:** covered by [edit-hunk-separator](../issues/archive/edit-hunk-separator.md), which rejects unescaped header-like body lines before writing. Anchor drift has separate [verification](anchor-identity-verification-2026-09-21.md). Do not reopen these from pre-fix reports alone.
- **Timeout loses output/state:** bounded host-received shell prefixes were added September 18; state reset remains deliberate. Use term for streaming jobs. Reports preceding that change do not establish a regression; unflushed subprocess buffers cannot be recovered.
- **Large combined show hides later values:** still a shared display budget, not a missing-output bug. Retain results and show focused slices separately; show.large raises but does not remove the cap. Vault/route reports ask for per-value budgets, but current notices and recovery suffice to leave this as an accepted ergonomic cost. This triage also hit the cap on broad transcript extracts and recovered with bounded extracts.
- **wm.capture existing peers and stale PI_SESSION_FILE provenance:** historical disabled backend; no new wm repair ticket. Current clients use native Orca coordination.

## Orca dispositions

The [live audit](orca-friction-audit-2026-09-21.md) supersedes the coordinator's initial diagnosis, not its observation:

- Completion capability works in current injected prompts; reconstructed preambles omit it. Historical version/injection failures remain unverified, not “fixed everywhere.”
- Start acceptance versus turn start now has local correlated confirmation; the discovered enrollment-readiness race was fixed and driven live.
- term and Orca terminals have distinct handle spaces; workers.read is the Orca reader. This is not evidence that one terminal was simultaneously dead and live.
- Passive native observation and native Pi model/effort launch support remain upstream gaps. Caller-owned terminal cleanup belongs to [orca-pi-launch-ownership](../issues/orca-pi-launch-ownership.md), not a duplicate issue.
- Explicit retry lineage is intentional. The separate stop_unknown report gets its own narrow investigation above.
- Blank model picker and orphaned waiter were not reproduced by the audit. Reopen only with the original state or stronger reproduction.
- Canonical checkout writes are possible from child worktrees: confirmed absence of filesystem isolation, not a Git worktree bug. A sandbox would be a product decision, not a drive-by fix.

## Other extension reports

Vault secret sourcing is already present in lib/vault.ts. Bracketed triage targets were normalized during vault-lifecycle implementation. Serial-invoker/editor write races and missing live UI evidence remain documented limitations in the archived vault issues; no new observation here justifies promoting them. The lint session's /tmp/wt-316 is a project worktree cleanup report, not an exec leak; not removed by this triage.

## Source locators

Paths below are relative to ~/.pi/agent/sessions; numbers are JSONL physical lines, not message IDs. These preserve report provenance without copying entire private transcripts.

- Routing failures, nine Orca reports, and cleanup loop: --Users-mlegls-dev-mmon-concept--/2026-09-21T05-56-50-842Z_01a0c289-e01a-701c-80dd-f1eccdda02c0.jsonl:441,683,814.
- jq original invocation/error and final report: --Users-mlegls-dev-mmon-concept--/2026-09-21T10-00-54-383Z_01a0c369-516f-7383-8373-8f64a0159749.jsonl:141–142,304.
- find/rows/capture report: --Users-mlegls-dev-mlegls-pi__worktrees-vault-document-the-manual-vault-trigger--/2026-09-20T06-45-45-056Z_01a0bd90-49df-71ab-967b-6ec23a5cc3f5.jsonl:99; also docs/issues/archive/vault-lifecycle.md.
- Earlier quoting/timeout/cap report: --Users-mlegls-dev-mlegls-pi__worktrees-pool-aware-routing--/2026-09-18T16-32-13-130Z_01a0b55c-7f4a-746c-8d3d-a228521bdcf0.jsonl:117.
- Consolidated vault reports: docs/issues/archive/vault-invoker.md and vault-lifecycle.md; route reports: docs/issues/archive/route.md.
