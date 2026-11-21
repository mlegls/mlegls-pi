docs/attachments/tracker-issues-lose-bodies-after-verification-update/drive.md (24 lines)
# Tracker verification drive

## Predictions (before use)

- A local editor can replace an issue body through stdin and read the complete replacement back, with its frontmatter intact.
- An accidentally empty replacement should be refused and a subsequent read should still show the previous body.
- The disposable replay can establish local CLI behavior; recovery of the two original contracts needs separate evidence from the incident.

## Encounter

At `4a2665572e778dfb6ece4f376c192596253facc1`, confirmed Bun 1.4.5 and ran `bun docs/attachments/tracker-issues-lose-bodies-after-verification-update/replay.ts`. The command provisioned the disposable Git-backed vault and returned 0; no services or credentials were needed.

| Action | Observation | Verdict |
| --- | --- | --- |
| Read seeded `stdin-replay` | `Original contract.`; stage `idea`, author `user:replay`; HEAD `ab02bdc`. | Starting state ready |
| Submit using the historical caller | Exit 1: “refusing to replace a non-empty body with a blank one; use --allow-empty-body to clear it”. The read still showed `Original contract.`, with the same metadata and HEAD. | Blank replacement refused |
| Supply the body as spawn stdin | Readback showed `Revised contract.` and the same metadata; HEAD advanced to `0948b70` (`tracker: update stdin-replay`). | Replacement persisted |
| From `~/dev/mmon/concept`, run `bun ~/.pi/agent/skills/tracker/scripts/issues.ts text <id>` for `verify-full-5000-card-profile-opening` and `joined-5000-profile-practice-and-map-stay-loading`. | Both returned `done` with substantive bodies including opening criteria, decisions and later verdicts. No writes to either issue. | Contracts readable |

## Frictions and replayable checks

No unresolved friction. The blank-body error identified the rejected action and stated the explicit clear option; no intentional clear was needed for this encounter.

Repeat the replay and require refusal, unchanged readback and unchanged HEAD after the historical call, then replacement text, unchanged frontmatter and a new update commit after the corrected call. Repeat both read-only Concept lookups and require bodies with the full-size opening criteria and verdicts. Those reads establish current availability; the [incident record](index.md) carries the historical write and restoration evidence.

## Review

Replayed at `96e71043` with Bun 1.4.5. The historical call exited 1; the original body, both frontmatter fields and HEAD `e7c55d1` survived. The corrected call preserved both fields and committed the revised body at `76310df`. Separate global tracker reads from the Concept checkout returned both completed contracts with their opening criteria and verdicts. Concept commit `46467165b7` records their restoration. No repair needed.
