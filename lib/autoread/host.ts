import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { createJiti } from "jiti";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { readerFiles, readerRequest, type ReaderConfig, type ReaderResult } from "./protocol.ts";

/** Explicitly configured visible readers only; ordinary sessions are untouched. */
export default async function (pi: ExtensionAPI) {
  const id = process.env.PI_AUTOREAD_ID;
  if (typeof id !== "string" || !id) return;
  const files = readerFiles(id);
  if (!existsSync(files.config)) return;
  const config: ReaderConfig = JSON.parse(readFileSync(files.config, "utf8"));
  process.env.PI_EXEC_PROFILE = "reader";
  const allowed = ["exec", "recall",
    ...(config.submission ? [config.submission.tool] : [])];
  let setupError: string | undefined;
  if (config.submission) {
    try {
      const install = await createJiti(import.meta.url).import(config.submission.extension, { default: true });
      await (install as (api: ExtensionAPI) => unknown)(pi);
    } catch (error) {
      setupError = "Could not load reader submission tool: " + String(error);
      allowed.length = 0;
    }
  }
  let submission: unknown;
  let result: ReaderResult | undefined;
  const persist = (value: ReaderResult) => {
    writeFileSync(files.result + ".tmp", JSON.stringify(value), { mode: 0o600 });
    renameSync(files.result + ".tmp", files.result);
  };
  let started = false;
  let startup: ReturnType<typeof setTimeout> | undefined;
  async function start(ctx: ExtensionContext) {
    try {
      if (setupError) throw new Error(setupError);
      if (config.compact !== false) {
        try {
          await new Promise<void>((resolve, reject) => ctx.compact({
            customInstructions: "Preserve context relevant to: " + config.request,
            onComplete: () => resolve(), onError: reject,
          }));
        } catch (error) {
          if (!/Nothing to compact \(session too small\)|Already compacted/.test(String(error))) throw error;
        }
      }
      const slash = config.model!.indexOf("/");
      const model = ctx.modelRegistry.find(config.model!.slice(0, slash), config.model!.slice(slash + 1));
      if (!model || !await pi.setModel(model)) throw new Error("Reader model unavailable: " + config.model);
      pi.setThinkingLevel(config.effort as Parameters<typeof pi.setThinkingLevel>[0]);
      pi.sendUserMessage(readerRequest(config.request!));
    } catch (error) {
      persist({ text: "", sessionFile: ctx.sessionManager.getSessionFile() ?? "", error: String(error) });
    }
  }
  pi.on("session_start", (_event, ctx) => {
    pi.setActiveTools(allowed);
    if (started || existsSync(files.result) || !config.request) return;
    started = true;
    pi.setSessionName("autoread: " + config.request.split("\n")[0].slice(0, 90));
    // Let session initialization finish before compaction or prompt submission.
    startup = setTimeout(() => { void start(ctx); }, 0);
  });
  pi.on("session_shutdown", () => { clearTimeout(startup); });
  pi.on("before_agent_start", () => {
    submission = undefined;
    result = undefined;
    pi.setActiveTools(allowed);
    return { systemPrompt: config.systemPrompt };
  });
  // Enforce the restriction even if another loaded extension changes the active tool list.
  pi.on("tool_call", event => {
    if (!allowed.includes(event.toolName)) return { block: true, reason: "Autoread is read-only" };
  });
  pi.on("tool_result", event => {
    if (event.toolName === config.submission?.tool && !event.isError) submission = event.details;
  });
  pi.on("agent_end", (event, ctx) => {
    const last = event.messages.filter(message => message.role === "assistant").at(-1);
    const text = last?.content.filter(part => part.type === "text").map(part => part.text).join("\n") ?? "";
    const error = setupError ?? (!last || last.stopReason === "error" || last.stopReason === "aborted"
      ? last?.errorMessage ?? last?.stopReason ?? "no answer"
      : config.submission ? submission === undefined ? "reader did not submit through " + config.submission.tool : undefined
      : last.stopReason !== "stop" || !text.trim() ? "reader did not finish a briefing" : undefined);
    result = { text, sessionFile: ctx.sessionManager.getSessionFile() ?? "", submission, error };
  });
  pi.on("agent_settled", () => {
    if (!result) return;
    persist(result);
  });
}
