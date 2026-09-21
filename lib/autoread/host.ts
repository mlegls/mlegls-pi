import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { createJiti } from "jiti";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readerFiles, type ReaderConfig, type ReaderResult } from "./protocol.ts";

/** Only BB-managed readers have a config; ordinary parent sessions are untouched. */
export default async function (pi: ExtensionAPI) {
  const id = process.env.BB_THREAD_ID;
  if (!id) return;
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
  pi.on("session_start", () => { pi.setActiveTools(allowed); });
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
    writeFileSync(files.result + ".tmp", JSON.stringify(result), { mode: 0o600 });
    renameSync(files.result + ".tmp", files.result);
  });
}
