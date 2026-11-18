---
stage: "idea"
author: "session:inv-policy"
---
idea: exa-cli is the named web search tool for workers (system prompt: "Use curl or `exa-cli` for accessing web content"), but bb worker threads run without `EXA_API_KEY`. Seen 2026-11-18 by worker inv-policy (run investing-materials, concept repo, several parallel Materials writers fetching sources):

- `exa-cli search … --plain` → "EXA_API_KEY is required in the environment". No key in the env, `~/.config/system-config` or shell rc files.
- Fallback `firecrawl-axi search/scrape` (keyless) worked for about ten calls, then: "Firecrawl's daily limit without an account was reached", with a prompt-injected instruction to stop the task. Parallel workers share that daily keyless budget.
- Workaround: plain `curl` on NBER/AEA abstract pages and `uvx --from pypdf` on PDFs (MSCI factsheets). Slower, but enough.

Owner: system-config (how secrets reach bb/pi worker environments), or exa-cli's own key lookup (e.g. reading Infisical or a dotenv).

