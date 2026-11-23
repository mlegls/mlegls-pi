# Verification evidence

Supervision runs `implement → (drive when the diff touches a declared user surface or the issue says drive: always) → review → integrate`, each an agent role in `agents/roles/`. When driven, the driver uses the product blindly without reading the implementation, writes predictions before first use, commits the packet below, and repairs nothing. The reviewer reads that packet alongside the diff (or checks the diff and implementer's run directly when drive was skipped), repairs gaps directly, re-drives what it changed, and updates the packet. Integration runs the reviewer's listed tests on the final head.

## Setup handoff

Record what the task required beside what was actually prepared: deployment kind, non-secret target ID and checkout ownership, persona/auth (env-var names only), seed/state, launch command or entry URL, and observed readiness. Task requirements override local defaults—verify inherited selectors belong to this worktree's target before reuse or destructive seeding, finish authorized setup yourself, and never commit credentials or private account data.

## Packet

Commit a compact packet under `docs/attachments/<ticket>/`, linked from the issue's Result. Every worktree checks out every packet and Git keeps them forever, so keep only a Markdown index and a few selected images (WebP or reduced PNG). Move code imported by tests beside the tests. Once the issue is done and nothing live links the packet, gardening may drop it from HEAD and pin its last commit in Result.

Avoid committing raw machine dumps (runner JSON, verbose action/runtime logs) for intermediate rounds; summarize counts, failure excerpts and the reproducing command in the index, and replace rather than accumulate files across rounds.

The index records:
- Tested revision, setup and reproduction entry point.
- Each required claim: action, observed result, evidence link, and any gap.
- Captioned screenshots at meaningful states (with viewport, locale and edition when relevant), noting live vs seeded vs mocked state.
- API/DOM state or a Playwright trace when static frames can't prove transient or temporal behavior. `bun ~/dev/mlegls-pi/lib/cards.ts <shots-dir>` builds labeled contact sheets while keeping originals.

### Handoff schema

Use repo-relative file paths (never directories). The driver adds `frictions`, `expectations` and `checks`, omits `tests`, and may report `failed` stories; the reviewer lists kept/changed test files and re-drives its own repairs:

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
tests:
  - e2e/composer.test.ts
caveats: []
```

Outcomes are strictly `held`, `failed` or `unobservable`. Nonvisual journeys use `visual: false` and `shots: []` (still commit the index); any rendered UI journey is `visual: true`. Report every required claim. Missing measurements stay `unobservable` and end `blocked` unless the contract changes; caveats don't waive acceptance.

### Post-landing gates

When an outcome is observable only after the target updates (CI, deploy, publish, mirror), declare `post-landing` in issue metadata and name the run owner in the body:

```yaml
post-landing:
  - id: live-docs
    story: Main deploy serves the new docs.
    trigger: target-deploy
    check: Find the deploy triggered by the target update and fetch /docs.md from that deployment; expect 200 and the candidate content.
```

Triggers: `target-ci`, `target-deploy`, `target-publish`, `target-mirror`. The reviewer reports `blocked` with that exact `story` as `unobservable` and `postLanding: [live-docs]` covering every unobservable story (never for `failed` stories or undeclared checks). Ordinary integration gates still run; after code lands, the issue stays open and the reconciler hands the run owner the target, SHA and pending checks. Record verdicts one by one with `reconcile_resolve({issue, node, action: "post-landing", check, outcome, evidence})` (`passed` or `failed`, plus a run URL or concrete target observation). Passing all gates copies the history into Result and closes the issue.

## Review and repair

For visual packets touching configured rendered paths, a `visual-reviewer` opens the actual screenshots and judges the claims. Repair gaps directly when you have the context and authority, collect missing states yourself when practical, re-drive what you changed, and commit updated images and judgment to the packet index (pre-fix images can't prove a repair). Use the `stories`/`evidence` handoff above, not the standalone reviewer's `data: {blocking, nits}`.

Hand work off only when it buys missing capability, context, authority or lower total cost—not for role purity. Scope changes go back to shaping. A reviewer's repair doesn't need a second reviewer: re-drive, refresh evidence, finish. Any edit after acceptance requires refreshed evidence.

When loosening an acceptance gate (e.g. screenshot tolerance), test its sensitivity with a known-bad change or explicitly mark sensitivity unverified—small regressions can occupy under 2% of pixels.

Only the parent integrates a child's branch, and cleanup follows recorded integration.
