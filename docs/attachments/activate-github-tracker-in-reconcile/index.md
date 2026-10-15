# Public GitHub tracker activation

Nonvisual first use, 2026-10-15. Entry from this package checkout after `mise run setup`:

```sh
bun docs/attachments/activate-github-tracker-in-reconcile/encounter.ts
```

## Required and prepared setup

Only **mlegls/reconcile-pr-transport-20261014-35767b2d** is mutated, using existing ordinary `gh` authentication as **mlegls**. The controller confirms exact private repository identity, issues enabled and push permission before seeding. It uses existing encounter/triage, encounter/info, encounter/agent, encounter/human and wontfix labels; no account, token, repository or label is created. No secret values are stored.

The command owns a temporary clone and sparse linked checkout. Canonical docs select GitHub with the five-role table; the linked checkout deliberately contains a physical vault and a conflicting Vault convention. A public snapshot completes before the disposable seed. The controller cleans up its exact issues and temporary files, including the foreground reconciler. It needs no ignored worktree files, server, browser or deployment.

## Observed claims

Successful live command: exit 0, 1m43s. Owned root **gh-88**, provisional child **gh-89**.

- Public `getTracker` selected the direct GitHub adapter from the sparse linked checkout, ignoring its physical docs copy. Public CLI snapshot, scoped snapshot, fields (with/without --json), text, returned native identity and native comment metadata agreed with the direct adapter. Snapshot retained schemaVersion:1 and empty legacy.
- `create --fields --body-file -` returned gh-88. Body-only stdin update replaced the complete body. Combined fields/body-file update preserved the native comment and exposed the updated metadata/body through both APIs.
- Ancillary `frontier` refused explicitly: `GitHub tracker: unsupported command frontier; use snapshot, text, fields, create, update, close or remove`.
- Production foreground reconciler with budget **zero** reserved the root as **reconcile:gh-88**, persisted its repository identity, and launched **zero workers**. Exact PID was terminated after observation; this was not explicit stop or target completion. Repeating the same stable reservation retained the same native assignment/claim.
- Production `beginRefinement` supplied **reconcile:gh-88/activation-provisional**. Public CLI create with PI_WM_RUN=gh-88 published gh-89 parented/assigned with that exact attempt token; public `remove` removed it from the lifecycle snapshot.
- Native `moveOut` published mapped human readiness, reason comment and unassignment; root remained OPEN. Public CLI close subsequently published the disposable result and made it done. This deliberately disposes of the probe, not a code-landing completion claim.
- Adding canonical docs/issues immediately selected its single canonical vault row despite the sparse linked checkout and conflicting physical vault. Removing the canonical vault and breaking the triage table refused with missing-mapping diagnostics; no local fallback occurred.

Both exact owned issues were closed/unassigned on cleanup. Existing repository resources and inherited issues were preserved; no paid workers, PR, deployment, browser or server was started. The controller removes its local owned clone and state after recording observations.

## Scope of evidence

This probes public wiring, canonical selection, root reservation and backend operations. It does not claim first implement/refine worker launch, collector landing, full live tree recovery or PR target acceptance. Those belong to the dependent `rehearse-github-tracked-reconcile` encounter. The existing scheduling view, provisional begin/accept/discard/adopt protocol, PR publication references and child-first target-close protocol are unchanged. Reconciler resolution now calls the backend's moveOut before releasing refinement claims.

## Regression checks

- `bun test lib/reconcile`: 14 pass / 0 fail, 166 assertions.
- `bun test skills/enabled/all/mlegls/conventions/tracker/scripts`: 24 pass / 0 fail, 681 assertions.
- `bunx tsc --noEmit`: clean.

No retained tests were added or weakened. Full existing suite results are recorded after the final run below.
