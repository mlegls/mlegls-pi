# Shell and transform: verification encounter

## Setup and readiness

Tested checkout `dsh-ptc-shell-and-transform-edits-verify` at `49011a8` plus this packet update. Required deployment per project handoff: anonymous-local dsh Web, no provider credential. Target: this worktree, loopback Web, isolated `dsh/.local/home`; no inherited selector. Persona: no-provider host-plugin diagnostic agent (not an authenticated model persona). Seed recreated as `dsh/.local/fixture/{a,b}.ts`, each exporting `foo(1)` / `foo(2)`. Entry point: `PATH="$PWD/dsh/node_modules/.bin:$PATH" DSH_HOME="$PWD/dsh/.local/home" dsh web --patch "$PWD/dsh/cordis.yml" --no-open --host 127.0.0.1 --port 0`.

Root and pinned dsh setup both completed; Web reported ready at loopback port 49268. I stopped that process after readiness. The prior worker's ignored trial patch/plugin and its session log are not present in this fresh worktree, so I could not dispatch its `run_code` program from the prepared entry point. No model credentials were inferred missing or requested.

## Required claims

- One program greps, transforms matches in two files, then runs tests: **unobservable in this fresh encounter**. Earlier implementer packet records a held diagnostic run, but that is not fresh verification evidence.
- Nested calls each appear as `tool/ptc-dispatch`: **unobservable**; the prior packet records the old session log, unavailable here.
- Shell result includes stdout/stderr/code and completes command: **unobservable** in this encounter.

No UI journey or screenshots. No code defect was exposed to repair. Known setup friction: ignored encounter plugin/seed artifacts did not travel with this worktree; I recreated only the documented seed and did not fabricate the missing diagnostic plugin.
Earlier implementer evidence is not evidence from this fresh encounter; see claims above. The documented diagnostic recipe describes a temporary host plugin, but that ignored plugin and log were not in this checkout. The local entry point observed ready at loopback port 49268 and was stopped.
