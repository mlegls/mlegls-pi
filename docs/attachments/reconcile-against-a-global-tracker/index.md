# Global tracker: parent join

Nonvisual CLI/library first use (`visual: false`, `shots: []`). Implementation
base: `fb3c65af9312bd64121c1a040d3edfd7bf03385b`. The children already implement
the backend, runtime/ledger and instructions; this residual joins their runnable
surfaces and exercises the committed instructions in a real sparse shell worker.
Residual/handler prompts now call collector-landed children satisfied, not globally
done. No scheduling/persistence logic or retained tests changed.

## Prepared setup and entry

Required: `mise run setup`, Bun, Git, mise and zmx. This checkout's setup completed
before first use. No credentials, model calls, browser or external service.

From any cwd, with CHECKOUT naming the checkout under review:

```sh
bun "$CHECKOUT/docs/attachments/reconcile-against-a-global-tracker/rehearse.ts" all
```

`all` (also the default) runs the existing vault fixture followed by the nine-mode
runtime fixture, including the new instruction encounter in `sparse`. `vault`,
`runtime` and `instructions` select the backend, all runtime modes, or the short
sparse/instruction encounter respectively. Invalid modes exit 2 without setup.

Each child owns a newly created temporary Git repository/vault and linked
worktrees. Runtime fixtures isolate board/state/cache/roster/zmx identities and
explicitly select shell workers, not the inherited BB runtime. The instruction
encounter copies this checkout's `agents/_common.md` and `agents/roles/*.md` into
its private roster before runtime imports; it does not assume installed symlinks
point here. Its CLI example is extracted from this checkout's tracker reference.
Persona: fixture Git identity and `session:doc-fixture` author, no authentication.
Seed: root spec, dependent tickets, outside dependency; refinement modes add
baseline/provisional children. Readiness is completed setup and registered shell
launch (the fixture checks both before acting). Every entry cleans only its owned
workers, processes and directories in finally; no resident target is needed.

## Instruction/backend/runtime encounter

Opened `instructions` from `/tmp` on 2026-10-12; exited 0 in 26 seconds. Owned
canonical target: `/private/tmp/rc-global-sparse-i3QUiS/repo`. The exact temporary
root was checked absent afterwards.

| Action | Observed result |
| --- | --- |
| Launch actual sparse implementer with committed role/common instructions | Neither worker nor collector had `docs/issues/`; attachments remained, setup and canonical CLI read succeeded. Delivered prompt included tracker-global friction and owner-only close procedures. |
| Execute reference's create/update block unchanged from the worker | Child fields were `part-of: example-parent`, `claimed-by: reconcile:example-parent/doc-refine`, author `session:doc-fixture`. Parent became ticket, priority removed, body replaced. Worker stayed clean at HEAD `d26ecf815fda372670c2f91241b818201082d713`, still with no tracker files. |
| File a seeded observation through the tracker | `instruction-friction` was global and outside the execution subtree; code HEAD and local issue-file absence were unchanged. This is fixture state, not a newly discovered defect. |
| Launch actual handler with committed handler instructions; write ruling/move-out from its sparse worktree | Owner immediately read ruling two; example child became goal/human with parent/claim removed, parent blocked by that child. Handler evidence remained local until code integration. |
| Continue from a done implementer report | Successor/setup read ruling two at fixed predecessor HEAD `ae679fcf97c506aa6685e712ff9a103929c851f0`; `drive: none` was honored, predecessor and handler code ancestry retained. |
| Try forbidden issue edit, then code-only integration | Source `d4a3db7aae0d67c2a50a7054a0cc39880cdd2baa` and target `a43f627fa11913744db8063dc3f743e5cc1504d1` stayed fixed on refusal, writer retained. Code-only landing reached `faa46184c9516cc1b326e40859348208ac59ff86` and retired its worker. |

The existing [vault fixture](../global-vault-tracker-backend/index.md) was also
opened from `/tmp` on the combined base: exit 0 in 4 seconds. Immediate canonical
writes, serialized field merges, invalid-write refusal, idempotent close/remove,
unrelated staged sentinel isolation and branch refusal all held. Exact owned
root `vault-first-use-mj6bIr` was removed; the intentional fixture hook refusal
reported validated publication separately from persistence, as designed.

## Existing regressions

```sh
bun test lib/reconcile lib/dispatch.test.ts lib/thread skills/enabled/all/mlegls/conventions/tracker/scripts
bunx tsc --noEmit
```

56 passed, 0 failed, 917 assertions across 16 files; TypeScript clean. No kept
assertions weakened, no new tests, no full-suite run. The integration gate owns
that full suite.

## Deployment boundary

This packet deploys the combined checkout into owned scratch targets and loads
its committed role text, not the installed package in the live pre-ledger
campaign. After parent integration, restart/reload the installed package and
apply agent instructions (`system-config`'s `agents-apply` where required).
Do not hot-swap that live campaign: pre-ledger state requires the maintainer's
manual ledger rebuild. This assignment neither rebuilds live state nor changes
installed symlinks. Code completion still belongs to the reconciler after its
owner-target landing.
