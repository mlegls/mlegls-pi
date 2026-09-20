import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

/** Current branch only, compaction applied; never ship thinking or tool-result bodies. */
export function ingressContext(ctx: ExtensionContext, code: string): string {
  const entries = ctx.sessionManager.buildContextEntries();
  const conversation: string[] = [];
  for (const entry of entries) {
    if (entry.type === "compaction") conversation.push("summary: " + entry.summary.slice(-6000));
    if (entry.type !== "message") continue;
    const message = entry.message;
    if (message.role !== "user" && message.role !== "assistant") continue;
    const text = typeof message.content === "string" ? message.content : message.content
      .filter(block => block.type === "text").map(block => block.text).join("\n");
    if (text.trim()) conversation.push(message.role + ": " + text.slice(-4000));
  }
  // No session context means no inferred task (e.g. standalone kernel consumers).
  return conversation.length ? conversation.slice(-6).join("\n\n").slice(-12000) + "\n\nCurrent exec cell:\n" + code.slice(0, 4000) : "";
}
