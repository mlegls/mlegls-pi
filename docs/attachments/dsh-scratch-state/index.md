# dsh scratch-state encounter

Tested revision: `cf7365d` on `dsh-scratch-state-verify` (includes implementation commits `826982a`, `cf7365d`).

## Setup and encounter

Task-required surface: dsh's `run_code` across two programs in one live session, using the pinned local dsh packages; no Cloud or provider credentials are specified for direct tool dispatch. Prepared target: this worktree's local dsh package, isolated `DSH_HOME` at `dsh/.local/home`; no seed/session was prepared. `bun run --cwd dsh setup` completed (frozen install and plugin build). The project's documented Web entry point started on `127.0.0.1:51287`; unauthenticated `/` returned 401 and the generated local login URL redirected (303). This confirmed server readiness, not an authenticated persona or an executable `run_code` session. Server was stopped; port no longer responds.

Runnable entry point: from repo root, `PATH="$PWD/dsh/node_modules/.bin:$PATH" DSH_HOME="$PWD/dsh/.local/home" dsh web --patch "$PWD/dsh/cordis.yml" --no-open --host 127.0.0.1 --port 0`.

## Claims

- One `run_code` stores a JSON intermediate and a later `run_code` reads it in the same session: **unobservable in this encounter**. The implementer's report says this passed using `ToolRuntime.execute` and an inline runtime, but that is not a fresh encounter through the Node PTC backend or a model-backed Web turn. No encounter evidence supports changing the claim to held here.
- Persistence choice: **unobservable in this encounter**. The implementation's issue note records memory-only semantics, but this encounter did not exercise reload or fork behavior. The recorded rationale is that `Session.append()` cannot mark plugin events ignorable and required custom events risk compatibility.

No UI journey was performed; no screenshots apply. The prepared setup's required first-use execution surface remains to be driven.
