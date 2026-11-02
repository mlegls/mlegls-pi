# Literal process-pattern implementation handoff

## Target and landing

The ticket's code lives in **pi-processes**, not mlegls-pi. Implementation commit: `4f6c5d4c101f5b5f293c77fe719a57c9abecc3e2`, branch `process-wait-pattern-alternation-implement`, based on `local-integration` at `ff4a792`.

Prepared, worker-owned checkout: `/home/mlegls/dev/pi-processes__worktrees/process-wait-pattern-alternation-implement`. Canonical `/home/mlegls/dev/pi-processes` was not edited, merged, or pushed. The parent must integrate the code commit into that repository's `local-integration`; merging this evidence-only mlegls-pi branch does not land the fix.

## First-use setup

- Deployment: local TypeScript extension/library, no browser or service required.
- Persona/auth: agent calling the registered `process` tool; no credentials.
- State: fresh `ProcessManager`; the smoke test launches its own short-lived `printf` process and cleans up in `finally`.
- Prepared dependencies: checkout-local `node_modules` symlink to the existing pi-processes installation. On a fresh checkout, use the repository's `pnpm install --frozen-lockfile` instead.
- Direct runnable story entry point (opened successfully):

```sh
cd /home/mlegls/dev/pi-processes__worktrees/process-wait-pattern-alternation-implement
node_modules/.bin/vitest run src/tools/index.test.ts -t 'rejects regex waits immediately while literal waits still match'
```

For interactive use, load this checkout's `src/index.ts` as the process extension in a fresh Pi session; the current session's already-loaded process tool is unchanged. Matching itself remains literal, with no regex or escape interpretation.

## Implementer observations (not independent acceptance)

- `wait` with `ready|rror` and a nominal 1800-second timeout throws the corrective literal-substring error before process lookup; suggests `"ready"`.
- A real `SERVER READY` stdout line matches literal `server ready` through the registered tool.
- Temporary direct tool probes rejected `ready|rror`, `ready.*error`, `ready.+error`, and `ready.?error` for both `pattern` and `readyPattern` before any manager operation, each under 1 ms.
- Temporary probes confirmed an ordinary URL and escaped pipe/wildcard markers pass validation unchanged. Escaping suppresses diagnostics only: backslashes still participate in literal matching.
- Descriptions now explicitly say `literal, case-insensitive substring`.

Focused regression command:

```sh
node_modules/.bin/vitest run src/tools/index.test.ts src/tools/actions/wait.test.ts src/tools/actions/start.test.ts
node_modules/.bin/tsc --noEmit
node_modules/.bin/biome check src/tools/index.ts src/tools/index.test.ts
```

Observed result: 48 tests passed across 3 files; typecheck and Biome passed. Initial formatting-only failures were corrected with Biome before the final run. No resident processes remain. No screenshot evidence: this journey is nonvisual.
