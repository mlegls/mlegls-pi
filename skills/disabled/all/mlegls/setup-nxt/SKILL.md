---
name: setup-nxt
description: "Use when asked to configure, initialize, install, or validate nxt in a project."
disable-model-invocation: true
---

nxt keeps orchestration judgment in a per-project pi session and mechanics in
its daemon. Setup supplies the project's coordinates and authority, then proves
that the two can communicate. The source checkout's README and binding schema
are the reference for the installed version, rather than a second schema here.

1. Inspect the target repo, tracker policy, remotes, existing `.nxt/`, and its
   GitHub Project with `gh-axi`. Confirm the Project Status values nxt uses:
   `Todo`, `In Progress`, `In Review`, and `Done`.
2. Resolve the remaining project choices together: Project, target branch,
   daemon identity/endpoint, `autoStart`, `autoMerge`, tracker-write authority,
   landing strategy, worker harness, and orchestrator provider/model. Model
   selection comes from current configuration, not an example's default.
3. Verify the installed tools and access. nxt uses Git, GitHub CLI access,
   mise, Bun, pi, Herdr, and Worktrunk; Television is optional. Prefer an
   existing nxt checkout. It is not a published npm package: if absent, clone
   `https://github.com/mlegls/nxt` into an agreed tools directory, run
   `mise install` and `mise exec -- bun install`, then expose its binary with
   `bun link --global` if needed.
4. Present the proposed `.nxt/` files and setup label changes for confirmation
   (`grilling`). Then write `.nxt/binding.json` from that version's schema and
   the resolved coordinates. Paths resolve from `.nxt/`: the repository path is
   usually `..`, guidelines `./orchestrator.md`, and local state `./state`.
5. Write `.nxt/orchestrator.md` with project-specific judgment: source pointers,
   ranking priorities, worker and landing choices, permitted tracker writes,
   and review/landing policy. Commit these two files; ignore `.nxt/state/`.
6. From a nested project directory, run `nxt daemon start`, `nxt daemon status`,
   `nxt state`, and one `nxt tick`. Start and inspect the orchestrator with
   `nxt orchestrator start` and `nxt orchestrator status`. Retain the handle and
   report discovery, identity, auth, and startup results. For Television, use
   the checkout's channel installation instructions.

A dedicated forcing label overrides automatic implement/land approval. It is
separate from readiness labels, which identify the next actor. Reuse or create
only the label agreed for setup.

The orchestrator is pi; workers currently use Herdr's pi or Claude harness.
The binding's provider/model selects the orchestrator, not a Claude worker.
Only landing writes the target branch. Validation proves setup without
creating runs, approving work, or making unrelated tracker changes. Occupied
endpoints and mismatched identities are findings to resolve, not lifecycle
checks to bypass.
