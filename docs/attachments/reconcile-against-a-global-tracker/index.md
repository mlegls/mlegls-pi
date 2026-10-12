# Global tracker: parent join

Nonvisual CLI/library first use (`visual: false`, `shots: []`). Implementation
base: `fb3c65af9312bd64121c1a040d3edfd7bf03385b`; final tested source:
`d446436e4d9d6df27137ba42b7021f4e651757b2`. The children already implement
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

Observed within the final `all` run from `/tmp` on 2026-10-12. Owned canonical
target: `/private/tmp/rc-global-sparse-DRb5fr/repo`. The exact temporary root was
checked absent afterwards.

| Action | Observed result |
| --- | --- |
| Launch actual sparse implementer with committed role/common instructions | Neither worker nor collector had `docs/issues/`; attachments remained, setup and canonical CLI read succeeded. Delivered prompt included tracker-global friction and owner-only close procedures. |
| Execute reference's create/update block unchanged from the worker | Child fields were `part-of: example-parent`, `claimed-by: reconcile:example-parent/doc-refine`, author `session:doc-fixture`. Parent became ticket, priority removed, body replaced. Worker stayed clean at HEAD `aae4a591c52a6341006e4dceda79321d89ee5247`, still with no tracker files. |
| File a seeded observation through the tracker | `instruction-friction` was global and outside the execution subtree; code HEAD and local issue-file absence were unchanged. This is fixture state, not a newly discovered defect. |
| Launch actual handler with committed handler instructions; write ruling/move-out from its sparse worktree | Owner immediately read ruling two; example child became goal/human with parent/claim removed, parent blocked by that child. Handler evidence remained local until code integration. |
| Continue from a done implementer report | Successor/setup read ruling two at fixed predecessor HEAD `f4d0e63de41d068a2038e27b7f135df91844e908`; `drive: none` was honored, predecessor and handler code ancestry retained. |
| Try forbidden issue edit, then code-only integration | Source `99a67b32e9a4a57995ac25c5c767159cdd30be4b` and target `283a39ff2dd187fd8a75913f480247544f9337bf` stayed fixed on refusal, writer retained. Code-only landing reached `5edc3aa677ab481aa899bdf7de6c6a3a262bdba5` and retired its worker. |

The existing [vault fixture](../global-vault-tracker-backend/index.md) was also
opened by the same final `all` entry: exit 0. Immediate canonical
writes, serialized field merges, invalid-write refusal, idempotent close/remove,
unrelated staged sentinel isolation and branch refusal all held. Exact owned
root `vault-first-use-0MCmua` was removed; the intentional fixture hook refusal
reported validated publication separately from persistence, as designed.

## Final cross-child run: held

The exact `all` command above exited 0 in **7m47s** on the tested source: vault
plus all nine runtime modes (ten runtime targets, including two close-replay
cuts). No model choices were used; these are actual registered shell workers,
production reconciler operations, canonical CLI state and saved-ledger receipts.
The [child runtime packet](../reconcile-with-global-tracker-and-landing-ledger/index.md)
explains each committed seed/cut and the deeper checks, rather than duplicating
its implementation here.

| Journey | Selected final-run observations |
| --- | --- |
| Collector → owner | Target `/private/tmp/rc-global-ledger-L8Qoig/repo`. Single b launch `b-implement-4`, thread `d0afb6ed-df9d-40f5-a091-72f00d03d4c2`, started at a's ledger head `9a6f697978c60e4790bfe2c657f2c66b261bc625` and read a's code. With root review held, canonical a/b were ticket, not done/frontier, each derived-claimed `landed in root (awaiting target)`; outside retained blocker a. Root residual prompt said children were **satisfied**, not done. After release a/b/root closed with their own result/evidence, outside became frontier; three gates/nine phases, owner HEAD `e6b55cc819d0433773f9b50cffa7c6ca72b71868`. |
| Restart | Target `rc-global-ledger-HNecVO/repo`: saved a head `eabb9d5b2f0efdcb4a4510a5f6fa3b33088b3e1e`, own reviewed result and one gate survived actual restart. Same b thread `3b2387a3-95a8-4b74-b8aa-34f0999ad2fb`; no a reintegration. Final three gates/nine phases and outside frontier. |
| Close replay | Delivered target `rc-global-ledger-6WdWAA/repo` and prepared target `rc-global-ledger-9txG3Z/repo`: each began with a closed and b/root pending. Prepared cut `5bc91d805884876d4c5729477f46b738da8fb979` had no root ledger receipt yet. Each recovered with zero launches/gates, closing a → b → root; prepared recovery transferred pending landings without merging again. |
| Linked owner | Target `/private/tmp/rc-global-ledger-hvLh6s/linked-owner`, restarted from main. Same b thread `735d9861-73ff-4728-9caf-4ce19d73eb34` began at a's head `d8147689579ad9d90804b135576f0940e3bbadc6`. All code/ledger deliveries stayed at linked owner; main had no code, but global results were visible there. Final owner HEAD `20afbe5839899fdbb219659e4ae4bb73f42b5005`, outside frontier. |
| Failed refine | Target `rc-global-refinement-KhE53q/repo`: x/y created under exact token `reconcile:root/root-refine-1`, writer stopped before cleanup, x/y removed, root spec restored. Baseline/friction/outside and foreign-claimed changed survived; zero dependent launches. |
| Replacement | Target `rc-global-refinement-WxvgqA/repo`: rediscovered crash-adjacent child absent from saved ownership; interrupted removal replayed before new `root-refine-3` writer. Explicit stop cleaned replacement children and preserved unrelated observations. |
| Adoption / accept replay | Targets `rc-global-refinement-3Kebes/repo` and `rc-global-refinement-qHcOJJ/repo`: interrupted ownership transfer retained x/y identities, converted claims to `reconcile:root`; each launched once and y read x code. Consumed-report cut replay kept collector HEAD exactly `5edf78f46ff46c038778a213bfaaf2c9badf6da0`, no second merge or child resurrection. |

Every leaf/root close retained the distinct own summary (`a reviewed result`,
`b reviewed result`, `root reviewed result`) and its own
`docs/attachments/fixture/<slug>.md` locator. Canonical done was not used as the
collector scheduling signal.

All owned fixture directories from this session's entries were independently
checked absent after the final run, as were all eight recorded refinement writer
PIDs. No browser, server, tunnel, deployment or shell worker remains.

## Existing regressions

```sh
bun test lib/reconcile lib/dispatch.test.ts lib/thread skills/enabled/all/mlegls/conventions/tracker/scripts
bunx tsc --noEmit
```

56 passed, 0 failed, 917 assertions across 16 files; TypeScript clean. No kept
assertions weakened, no new tests, no full-suite run. The integration gate owns
that full suite. After the prompt terminology repair, `bun test lib/reconcile`
passed again (12 tests, 155 assertions), with TypeScript clean. No other
production changes followed.

## Deployment boundary

This packet deploys the combined checkout into owned scratch targets and loads
its committed role text, not the installed package in the live pre-ledger
campaign. After parent integration, restart/reload the installed package and
apply agent instructions (`system-config`'s `agents-apply` where required).
Do not hot-swap that live campaign: pre-ledger state requires the maintainer's
manual ledger rebuild. This assignment neither rebuilds live state nor changes
installed symlinks. Code completion still belongs to the reconciler after its
owner-target landing.
