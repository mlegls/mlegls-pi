---
name: setup-ts-deep-modules
description: "Use when enforcing TypeScript package boundaries through root entry points."
disable-model-invocation: true
---

Make every package a **deep module**. The public surface is a package's **root files** — a package may expose several small entry points (`index.ts`, `client.ts`, …); barrels re-exporting a subtree are discouraged. *Anything* in *any* subfolder is private (by convention `lib/` for implementation, `tests/` for co-located tests), so new folders never need config changes. Packages are flat: no package inside a package. Layering between packages is a separate concern, left as a commented stub.

Four rules, all `error`: entry-point boundary (outsiders import only root files), intra-package freedom, tests-through-entrypoints (`tests/` may import entry points and its own fixtures, never any package's internals — not even its own), no cycles.

1. **Detect**: package manager from the lockfile; packages root (`src/packages` if `src/` exists, else `packages` — confirm if the repo has another convention); existing `.dependency-cruiser.*` (merge the rules in rather than overwrite, and say what you added).
2. **Install** `dependency-cruiser` as a devDependency.
3. **Config**: copy [`dependency-cruiser.config.cjs`](./dependency-cruiser.config.cjs) to the repo root as `.dependency-cruiser.cjs`; set `PACKAGES_ROOT`. The rules are path-depth based and extension-agnostic — nothing else to adapt.
4. **Wire in**: add a `lint:boundaries` script (`depcruise <packages-root>`) and fold it into the umbrella check that runs typecheck (if none, tell the user to add it to CI). Don't touch `tsconfig` or add path aliases.
5. **Scaffold `<packages-root>/example/`** as a copy-me template: `index.ts` delegating to `lib/impl.ts` (visibly deep, not a pass-through), `tests/example.test.ts` importing only `../index`.
6. **Prove the rules bite** — the completion criterion for the whole skill: `lint:boundaries` passes clean; add a deep import (`../lib/impl`) to the test and it must fail with `tests-through-entrypoints`; revert and it passes again. If it doesn't fail, fix the wiring before finishing.
7. **Document**: `<packages-root>/README.md` — layout, "import only through entry points", discourage barrels, how to run `lint:boundaries`; then one context-pointer line in `CLAUDE.md` (else `AGENTS.md`, creating `AGENTS.md` only if neither exists), e.g. `Packages are deep modules: see [src/packages/README.md](./src/packages/README.md) before adding or importing one.`

Notes: the config's `$1` back-references are what let a package reach its own internals while outsiders can't — don't flatten them into per-package rules. `.cjs` so `module.exports` works in `"type": "module"` repos.
