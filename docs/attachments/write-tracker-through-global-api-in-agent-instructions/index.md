# Global tracker instruction review

Nonvisual source review, 2026-10-12. Base: `6e123b1d931e7cd7cedae71c6b8e5c8ffff6cff8` (child 1's committed backend). This packet reviews instructions, not deployed prompt behavior; the parent join owns post-landing acceptance alongside child 2's scratch rehearsal.

## Contract comparison

Read the parent's dated decisions and execution contracts in `docs/issues/reconcile-against-a-global-tracker.md`, `lib/tracker.ts`, `routing.md`, and the writing-skills precedent. Compared the command block to `bun skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts --help`: all six verbs and options match. Help prints usage and exits 2. Inspected `findIssuesDir`, `fieldsOf`, `storageFields`, `replaceContract` and `mutate` in that CLI: canonical git vault, non-git upward discovery, normalized relations, null removal, body replacement and close/claim/blocker behavior match the documented protocol. No tracker mutation was made for this review.

- Refine/compile: promotion and whole-body parent sharpening go through the tracker. Child create includes the supplied attempt token atomically; adoption names and re-claims children, cleanup belongs to the reconciler, accepted children keep the run reservation. Only shared stubs commit locally.
- Handler/common/reviewer/tidy: rulings, move-outs and unresolved friction are immediate global writes. Friction stays outside the active execution subtree and is linked from reports; ordinary triage closes with a disposition or transfers evidence, never removes arbitrary issues. Two-minute fixes and read-only authority remain.
- Implement/drive/review and lifecycle/supervision: local code/evidence handoffs remain intact; reports and collector landings never close the execution ticket. The ledger carries pending landings; the owner's target may be a non-main checkout. Standalone close waits for recorded acceptance and actual landing.
- GitHub/GitLab retain their existing model conventions and publishing commands; no new vault CLI support is claimed for them.

## Scoped contradiction search

Searched the owned Markdown sources for `implementation branch`, `tracker files only`, `commit children`, `on their branch`, `closed on`, `git show`, `docs/issues`, `stage: done`, and `commit tracker`. Examined hits: no branch-carried issue-write/completion instruction remains. `git show` hits prohibit branch-local issue reads; `docs/issues` hits describe canonical backend storage/archival; `stage: done` describes the lifecycle result. Generic worker-branch code/evidence commits are intentionally retained. `git diff --check` passes. No runtime/source tests changed or run: this ticket explicitly needs no new tests, process or model run.

## Deployment and first-use handoff

Source paths: `agents/_common.md`, `agents/compile.md`, `agents/reviewer.md`, `agents/tidy.md`, `agents/roles/*.md`; `skills/enabled/all/mlegls/conventions/tracker/SKILL.md` and its vault/lifecycle/GitHub/GitLab references; `skills/enabled/all/mlegls/lifecycle/{advance,orient,implement}/SKILL.md`; `skills/enabled/all/mlegls/orchestrations/supervise/SKILL.md`.

Required target: the parent's combined revision with child 2's isolated scratch git repository and shell-worker rehearsal, not the live campaign. Actually prepared here: source instructions only; inherited `mise run setup` completed, and the bundled CLI help was opened above. No live prompt deployment, persona/auth, seed, browser or server was needed or created. Installed skill/role symlinks were not assumed to switch to this worktree.

After integration, the supervisor restarts/reloads the installed package and agent instructions (system-config's `agents-apply` for installed role material where required) before launching fresh agents. Do not hot-swap this pre-ledger live run; the parent owns cutover and any manual ledger rebuild. Reproduction entry for this source review: `bun skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts --help` from the combined checkout, then read the source paths above beside child 2's rehearsal. Deployed sparse-create, global-ruling and collector/target-close stories remain for that post-landing encounter; this search is not product-success evidence.
