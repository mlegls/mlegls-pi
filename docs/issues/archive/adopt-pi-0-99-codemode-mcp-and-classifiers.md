---
stage: done
assignee: agent
author: session:01a0f065-abaf-776c-bc8b-419cb9b312e4
priority: 2
---

Pi 0.99.0 (2026-09-29; installed is 0.87.1) adds, as built-in extensions: codemode (model-written JavaScript in a QuickJS sandbox calling pi tools via `tools.<name>()`, parallel, `store/load` JSON persisted per session branch, `max_output_tokens` with spill file), `tool_search`, native MCP (`mcp.json`, `pi mcp add`), classifier models in `ModelRuntime` (`classify()`, TypeSafe `jev-latest` plus Jev on OpenRouter, Cloudflare, Vercel, OpenCode; `models.classify()` from codemode with cost counted), virtual models (`pi.registerVirtualModel()`, `examples/extensions/jev-router.ts`), tool exposure (`direct|model-only|codemode|deferred|hidden`, `ctx.executeTool()`), and Sign in with ChatGPT on the OpenAI provider.

Each overlaps something we own:
- codemode vs `extensions/exec`: exec's kernel is Node with lib imports, async output handles and late delivery (`lib/ingress.ts` novelty), board/wm/loadSkill/views. Codemode reaches only tools. Candidate shape: expose lib capabilities as codemode-exposed tools and retire the kernel; what's lost is imports and async handles.
- native MCP supersedes [[projects/mlegls-pi/issues/archive/mcp-through-exec]].
- `ModelRuntime.classify()` could own `lib/decide.ts`'s transport and credentials (TypeSafe/Cloudflare today), giving provider fallback and cost accounting for free; `lib/decide.ts` would keep its question shapes.
- virtual models vs `lib/route.ts` model selection.
- 1 MiB structured bash results vs the bash extension's spill-backed truncation.

Want: upgrade, then decide per overlap whether to delete ours, adapt, or keep. The exec decision is the big one and needs a comparison over real sessions before the kernel goes.

## result

Done in the rebuild (`4b79baa`), per overlap:
- codemode replaced `extensions/exec` outright (`codemode.mode: only`); lib capabilities are tools (board, mail, dispatch, reconcile). Imports and async handles are gone; exec's late-output filter is parked.
- native MCP: `~/.pi/agent/mcp.json` with `cua` and `chrome`, exposed through codemode.
- `lib/decide.ts` runs over `ModelRuntime.classify`.
- `lib/route.ts` deleted; `extensions/stances` provides `stance/<agent>` virtual models.
- the bash extension deleted for pi's built-in bash.

No comparison over real sessions was run before the kernel went; the prototype is tagged `prototype`.
