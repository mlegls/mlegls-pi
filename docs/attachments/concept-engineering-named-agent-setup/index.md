# Concept Engineering setup readiness

Setup stopped before changing agent files, registry, notes, the life or schedules.

## Required target

The real Beelink installation: Concept BB project `proj_fgz6kudzrk`, source `src_rf47pt6w54` on `host_a22uydxjy2`, checkout `/home/mlegls/dev/mmon/concept`. Agent files belong in that checkout; registration belongs in `/home/mlegls/.config/system-config/home/.pi/agent/settings.json`. The actual installed pi package resolves to `/home/mlegls/dev/mlegls-pi` through the global settings.

## Observed readiness

- Worker starting revision: `6aac13aac119bd39a52e2a7c676cd61bdbd79356` (named-agent runtime and fixture are present).
- Installed main checkout observed revision: `072ae6b7` (tracker update). `extensions/agents/` does not exist there. The worker base is not an ancestor of installed main (`git merge-base --is-ancestor` exits 1).
- `bb provider models pi` lists no `agent/concept-engineering`; the global registry currently has no `agents` entry.
- The delivered Hermes importer exists in installed main, but not in the worker base: `bun extensions/context/life/import-hermes.ts concept-engineering --dry-run` from this worker reports `Module not found`. The ticket's completed import prerequisite records `cc3345fc`.
- Concept starting revision: `d6fbcfa33604f3b5711f4025132192fb904ed9de`. Its pre-existing untracked support-email draft was untouched.
- System-config starting revision: `a62e04bafffd0a5cbf6bf994e98c26f7f7cd4f0a`. It already has local changes in `.config/mise/config.toml`, `home/.pi/agent/mcp.json` and `home/.pi/agent/settings.json`; all were left untouched. The settings diff is pi-generated version/device/extension-version state.

## Next step

The parent owns integration. Land the named-agent prerequisite in the installed main package and supply a setup-worker revision containing both that runtime and the delivered importer. Then resume setup against the actual installation. A temporary fixture override would leave the ordinary named-agent and automation entry points unprepared.

No real Concept Engineering manifestation was started, so imported-message summarization, retrieval, notes and automation claims are unobserved. No server, browser, background process or external deployment was started.
