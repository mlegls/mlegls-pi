# Semantic tracker preflight

Flags issues whose prose looks stale, already delivered, or misaligned with their parent before you pick work.

```sh
bun ~/.pi/agent/skills/tracker/scripts/issues.ts lint [slug]
bun ~/.pi/agent/skills/tracker/scripts/issues.ts mine [slug]
bun ~/.pi/agent/skills/tracker/scripts/issues.ts frontier [slug]
```

Omit `slug` to run across all live issues. `lint` evaluates changed issues and up to 10 linked Markdown docs (12k chars for the issue, 4k per linked doc) via Jev; `mine` and `frontier` read the local cache (`$XDG_CACHE_HOME/mlegls-pi/tracker-lint`, keyed by canonical project path and issue). Pass `--json` for probabilities, quotes, timestamps and status. Delete a cache entry to force re-evaluation.

Findings are advisory: they never block dispatch or mutate issues, and unlinked decisions or current code behavior are outside what lint sees.
