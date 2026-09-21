# Archived standalone extensions

The package manifest explicitly lists the active extensions, including the
independent `lib/*/host.ts` entrypoints. Archived adapters here are not auto-loaded.

- `board`, `exa`: original standalone tool adapters and their compatibility tests.
- `record`, `session`, `session-meta`: standalone adapters to the current library installers.
- `firecrawl`, `harness-continue`, `lsp`, `mcp`: previously disabled extensions.

An adapter can be loaded explicitly with Pi's `-e`, but do not combine one with
the manifest entrypoint for the same library. The outline-read directory had no
extension entrypoint; its implementation, dependencies, and tests now live in
`lib/outline-read`.
