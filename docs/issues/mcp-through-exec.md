---
stage: idea
assignee: human
author: session:01a0ce0b-0c34-7725-9ea2-05261a1c3f18
---

If a task needs an MCP server that has no CLI (e.g. godot-mcp-pro in `~/.config/mcp/servers.json`), expose it through exec rather than pi-mcp-adapter. Wait for a concrete task to fail without MCP; don't build ahead of one.

Origin: 2026-09-23, asked whether the Stripe, Convex and Clerk MCP servers are worth having beyond their CLIs. They aren't: `convex run` evaluates inline readonly queries and `convex insights` exists, so the MCP's `runOneoffQuery`/`insights` edge is gone; `clerk api` and `stripe` resource commands cover their APIs; Stripe docs are served as `.md`. MCP's prod scoping (Convex `--cautiously-allow-production-pii` vs `--dangerously-enable-production-deployments`, `--disable-tools`) is only nominal for an agent that also has a shell.

Why exec over pi-mcp-adapter: the adapter is a second tool surface beside exec (a proxy tool, its own `/mcp` UI and config layers); its results bypass exec's show filtering and `state`, and can't be composed in code. exec is already the "code mode" shape (Cloudflare's Code Mode; Anthropic's "code execution with MCP"): tools as a typed API called from code, not definitions in context.

Candidates:
- [mcporter](https://github.com/openclaw/mcporter) (formerly steipete/mcporter): TS runtime (`createRuntime`, `callOnce`, `createServerProxy` mapping tools to camelCase methods), `mcporter call server.tool …`, OAuth (`mcporter auth`), `emit-ts` typed clients, and `generate-cli` turning a server into a standalone CLI. `generate-cli` is closest to the axi pattern and also serves Paseo workers on other harnesses. It imports Cursor/Claude Code/Codex configs; check that it doesn't pick up unwanted servers.
- `extensions/disabled/mcp/index.ts` (89 lines, stdio via `@modelcontextprotocol/sdk`, registry at `~/.config/mcp/servers.json`): has the connection code; only tool registration would become a `lib/mcp.ts` export like `mcp.<server>.<tool>(args)`.
