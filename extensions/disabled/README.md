# Archived standalone extensions

The package manifest loads only `extensions/exec/index.ts`. Exec installs host
integrations from `lib/*/host.ts`; these directories are not auto-loaded.

- `board`, `exa`: original standalone tool adapters and their compatibility tests.
- `featherless`, `fence`, `record`, `session`, `session-meta`, `system-prompt`,
  `workspace`: standalone adapters to the current library installers.
- `firecrawl`, `harness-continue`, `lsp`, `mcp`: previously disabled extensions.

An adapter can be loaded explicitly with Pi's `-e`, but do not combine one with
exec's installation of the same library. The outline-read directory had no
extension entrypoint; its implementation, dependencies, and tests now live in
`lib/outline-read`.
