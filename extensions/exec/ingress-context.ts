import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

/** Current branch, compaction applied. Provider-visible reasoning text only; never opaque signatures or tool-result bodies. */
export function ingressContext(ctx: ExtensionContext, code: string): string {
  const entries = ctx.sessionManager.buildContextEntries();
  const conversation: string[] = [];
  const intent: string[] = [];
  for (const entry of entries) {
    if (entry.type === "compaction") conversation.push("summary: " + entry.summary.slice(-6000));
    if (entry.type !== "message") continue;
    const message = entry.message;
    if (message.role === "user") intent.length = 0;
    if (message.role === "assistant" && Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block.type === "thinking" && block.thinking?.trim()) intent.push("Reasoning context: " + block.thinking.slice(-2000));
        if (block.type === "toolCall") intent.push("Tool request: " + block.name + " " + JSON.stringify(block.arguments).slice(-2000));
      }
    }
    if (message.role !== "user" && message.role !== "assistant") continue;
    const text = typeof message.content === "string" ? message.content : message.content
      .filter(block => block.type === "text").map(block => block.text).join("\n");
    if (text.trim()) conversation.push(message.role + ": " + text.slice(-4000));
  }
  // No session context means no inferred task (e.g. standalone kernel consumers).
  const current = code.length > 4000 ? code.slice(0, 2000) + "\n[command middle omitted]\n" + code.slice(-2000) : code;
  return conversation.length ? conversation.slice(-6).join("\n\n").slice(-12000)
    + (intent.length ? "\n\nCurrent turn intent:\n" + intent.slice(-6).join("\n").slice(-6000) : "")
    + (current ? "\n\nCurrent command:\n" + current : "") : "";
}
