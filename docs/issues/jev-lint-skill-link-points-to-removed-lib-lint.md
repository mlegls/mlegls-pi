---
stage: done
assignee: agent
author: "session:01a0f6a0-ff40-771b-b2e0-7b4b2c2a1dfe"
---
Done: the setup-project skill no longer advertises a runner that doesn't exist. `lib/lint` was removed deliberately in `b40cdecd` ("Cut to the confirmed core"), so delete the dangling `skills/enabled/all/mlegls/conventions/setup-project/references/lints/jev-lint` symlink and the "Meaning, as a ranked advisory" paragraph in `references/lints.md`, and grep this repo's skills/agents for other `jev-lint` references. Report (don't edit) any Concept instructions that still name it so they can be fixed there.

Concept’s `plan.back` browser fold ran its documented advisory check:
`bun ~/.pi/agent/skills/setup-project/references/lints/jev-lint/run.ts . cc21de9ca646db3291b1f15043ee1e3747bc819e`.
It returned `Module not found`. The skill’s `references/lints/jev-lint` symlink points to
`../../../../../../../../lib/lint`; `~/dev/mlegls-pi/lib/lint` is absent. The skill’s
`references/lints.md` still instructs projects to invoke that runner. A filesystem search
found no replacement runner in the canonical checkout. No judgments ran.

Workaround: report advisory unavailable; keep the deterministic checks and browser
encounters. Owner: mlegls-pi’s setup-project lint integration. Restore a runnable advisory
entry point or update the skill and dependent project instructions when its removal is intentional.

## Result

done

The jev-lint removal holds, and I fixed the stale "Three kinds of check" wording the driver filed (commit `587b79ef`). I did not close that issue, setup-project-lint-category-count-is-stale, because the fix hasn't landed yet. The reconciler can close it once this branch lands.

- **Diff:** The dangling `jev-lint` symlink is deleted. The "Meaning, as a ranked advisory" paragraph is gone from `references/lints.md`. A grep of this repo for `jev-lint` and `lib/lint` finds nothing in skills or agents; the only hits are the worktree's own `.wm/launch.env` handle and the driver's evidence packets.
- **Wording fix:** The file now opens "Two kinds of check", matching the honesty and size categories that remain.
- **Tests:** `bun test lib/board.test.ts` passes (3 tests). `mise run test:affected` doesn't exist in this repo, so I didn't run it.
- **Unrelated commits in the range:** The a52c3e82..HEAD range also carries two things from outside this ticket: a board CLI `--help` and usage-error change (`lib/board.ts`, `lib/board.test.ts`, with its own evidence packet), merged in at `5e0deef5`, and a driver note on the `codemode-read-does-not-honor-quoted-space-containing-paths` issue. I left both alone.
- **Concept:** `AGENTS.md:14` in `/Users/mlegls/dev/mmon/concept` still tells readers to run the removed `jev-lint/run.ts`. I did not edit it; it's already owned by `projects/concept/issues/jev-lint-command-points-at-an-absent-skill-file` and `projects/concept/issues/advisory-meaning-lint-entry-point-is-missing`.

```yaml
commit: 587b79ef
stories:
  - story: Guidance no longer advertises removed advisory
    outcome: held
  - story: Dangling runner symlink removed
    outcome: held
  - story: Skills and agents reference audit
    outcome: held
  - story: Report remaining Concept instructions without editing
    outcome: held
evidence:
  path: docs/attachments/jev-lint-skill-link-points-to-removed-lib-lint/index.md
  visual: false
  shots: []
tests:
  - lib/board.test.ts
fixed:
  - "setup-project-lint-category-count-is-stale: 'Three kinds' → 'Two kinds' in references/lints.md (587b79ef)"
filed: []
caveats:
  - "setup-project-lint-category-count-is-stale is left open until 587b79ef lands; close it then."
  - "Concept AGENTS.md:14 still names jev-lint (reported, not edited)."
```

Evidence: [docs/attachments/jev-lint-skill-link-points-to-removed-lib-lint/index.md](docs/attachments/jev-lint-skill-link-points-to-removed-lib-lint/index.md)
