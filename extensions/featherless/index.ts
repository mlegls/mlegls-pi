import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

type Catalogue = { data: Array<{ id: string; name?: string; context_length: number; max_completion_tokens?: number; pricing?: { prompt?: string; completion?: string } }> };
function parse(value: unknown): Catalogue {
  const c = value as Catalogue;
  if (!Array.isArray(c?.data)) throw new Error("Invalid Featherless catalogue");
  c.data = c.data.filter(m => m?.context_length !== undefined);
  if (!c.data.length || c.data.some(m =>
    typeof m?.id !== "string" || !m.id || !Number.isInteger(m.context_length) || m.context_length <= 0 ||
    (m.max_completion_tokens !== undefined && (!Number.isInteger(m.max_completion_tokens) || m.max_completion_tokens <= 0))
  )) throw new Error("Invalid Featherless catalogue");
  return c;
}
function price(value?: string) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n * 1_000_000 : 0;
}

export default async function (pi: ExtensionAPI) {
  const baseUrl = "https://api.featherless.ai/v1";
  const directory = join(getAgentDir(), "cache");
  const path = join(directory, "featherless-models.json");
  let models: Catalogue | undefined;
  let fetchedAt = 0;
  try {
    const cached = JSON.parse(await readFile(path, "utf8"));
    models = parse(cached.catalogue);
    fetchedAt = Number(cached.fetchedAt) || 0;
  } catch { /* Missing or invalid caches are refetched. */ }
  if (!models || Date.now() - fetchedAt >= 86_400_000) {
    let fresh = false;
    try {
      const response = await fetch(baseUrl + "/models", { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error("HTTP " + response.status);
      models = parse(await response.json());
      fresh = true;
    } catch (error) {
      if (!models) throw new Error("Featherless discovery failed", { cause: error });
      pi.on("session_start", async (_event, ctx) => {
        ctx.ui.notify("Featherless discovery failed; using cached catalogue.", "warning");
      });
    }
    if (fresh) {
      try {
        await mkdir(directory, { recursive: true });
        const temporary = path + "." + crypto.randomUUID();
        await writeFile(temporary, JSON.stringify({ fetchedAt: Date.now(), catalogue: models }));
        await rename(temporary, path);
      } catch { /* Cache failures must not prevent registration. */ }
    }
  }
  pi.registerProvider("featherless", {
    name: "Featherless",
    baseUrl,
    apiKey: "$FEATHERLESS_API_KEY",
    api: "openai-completions",
    models: models!.data.map(m => ({
      id: m.id,
      name: m.name ?? m.id,
      reasoning: false,
      input: ["text"],
      contextWindow: m.context_length,
      maxTokens: Math.min(m.max_completion_tokens ?? 4096, m.context_length),
      cost: { input: price(m.pricing?.prompt), output: price(m.pricing?.completion), cacheRead: 0, cacheWrite: 0 },
      compat: { supportsDeveloperRole: false, supportsStore: false, supportsReasoningEffort: false, maxTokensField: "max_tokens" },
    })),
  });
}
