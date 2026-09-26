# Verification evidence

Supervision runs implementation → fresh encounter → visual judgment when the journey is rendered → integration. The encounter worker uses the project's prepared setup, Jev for semantic navigation and existing Playwright replays where appropriate. The visual reviewer opens the actual images; a collector's `held` is not a visual verdict. Backend-only journeys use API, CLI or library evidence without an extra visual worker.

Before driving, check the handoff's deployment kind and owned target, persona/authentication, seed or restored state, and runnable entry point. Do not substitute anonymous-local setup for a Cloud requirement. Wait for setup to finish. Resolve known, authorized preparation locally rather than handing it back by default. Never publish credentials or private account data in evidence; use test personas or redact before committing.
The setup handoff distinguishes the task's required environment from what was actually prepared: deployment kind, non-secret target identifier and checkout ownership, persona/auth method, seed/state, launch command or entry URL, and observed readiness (or the still-running setup and what remains). The requirement wins over a generic setup default. Before reusing inherited selectors or credentials, confirm they address the intended checkout-owned target; before destructive seeding, establish ownership explicitly. Reuse the project's setup tooling rather than inventing another launcher. Unknown readiness is not a failed encounter: finish authorized setup and observe its result before driving.

## Packet

Commit a small packet under `docs/attachments/<ticket>/`, linked from the ticket's Result. Prefer a Markdown index and selected images over a transcript dump. `.wm/` is scratch storage and disappears with the worktree.

The index records:

- Tested revision, setup and reproduction entry point.
- Each required claim: action, observed result, evidence link and any gap.
- Captioned screenshots at the meaningful states of the changed journey; viewport, locale and edition where relevant. Distinguish live interaction, seeded/restored state and mocked fixtures.
- API/DOM state or a linked Playwright trace when screenshots cannot establish the claim. A final frame does not prove a transient state or temporal behavior.

A few well-chosen frames usually suffice. Keep broad device/locale matrices and hypothesis-driven audits separately scoped. Existing Playwright recording and `bun ~/dev/mlegls-pi/lib/cards.ts <shots-dir>` cover traces and labeled contact sheets; preserve the originals for close inspection.

For supervised verification, use this handoff (paths are repository-relative files, not directories):

```yaml
stories:
  - story: The last response remains above the composer
    outcome: held
  - story: Sending preserves the draft until acceptance
    outcome: held
evidence:
  path: docs/attachments/example-ticket/index.md
  visual: true
  shots:
    - docs/attachments/example-ticket/01-session-response.png
    - docs/attachments/example-ticket/02-session-sending.png
caveats: []
```

Use `held`, `failed` or `unobservable` exactly. For a nonvisual journey set `visual: false` and `shots: []`; still commit the evidence index. Any rendered UI journey is visual, even if the collector's checks use DOM assertions. Report every required claim, not just the ones that passed. An honest description of missing measurements is not the requested measurement: end `blocked`, or obtain an explicit contract change. Caveats do not waive acceptance requirements.

## Visual judgment and recovery

A fresh visual reviewer receives the ticket and packet. Open the actual screenshots (contact sheets first when useful) and judge the required claims. If you have the context and authority to repair a gap, repair it directly, re-drive the affected behavior and refresh the evidence. Collect missing states yourself when practical. Commit the repairs and your judgment with current image references to the packet index. Pre-fix images cannot establish a repaired outcome. Use the same `stories`/`evidence` handoff, not the standalone reviewer's `data: {blocking, nits}` format. Missing states remain `unobservable` until observed. Unrelated improvements are nonblocking observations with their own owner.

A handoff should buy missing capability, context, authority or lower total cost, not preserve role purity. Repair size alone does not decide it. Use `resume … verify` when a fresh collector is actually useful; scope changes go to shaping. A reviewer's repair does not automatically require another reviewer: re-drive what changed, refresh the evidence, and finish. The loop retains earlier workers until integration or explicit disposal. `resume … integrate` retries an accepted integration; it does not waive acceptance, and edits after acceptance need updated evidence.

Changing an acceptance gate requires checking its sensitivity: after relaxing a screenshot tolerance, try a known-bad change or leave sensitivity explicitly unverified. A small important regression may occupy fewer than 2% of pixels.

Only the parent integrates a child's branch. Cleanup follows recorded integration, not apparent inactivity. The loop links the committed packet when closing the ticket; the evidence survives worktree retirement.

## First-use trial

Try this on a few real visual and nonvisual tickets before changing model defaults. Record completed encounters, setup failures, parent interventions, evidence requested by the reviewer and defects found, along with model/effort. Compare accepted completion cost, not just collector token cost. Keep trial notes with the packet; no permanent telemetry system is required.
Count avoidable handoffs too: fixes bounced to an implementer despite sufficient reviewer context, trivial missing states sent to another collector, duplicated judgment and repeated setup. Keep a stage only where its contribution justifies the context and scheduling cost.
