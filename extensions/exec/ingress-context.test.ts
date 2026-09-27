import { expect, test } from "bun:test";
import { ingressContext } from "./ingress-context";

test("current intent includes visible reasoning and calls, not signatures or tool results", () => {
  const entries = [
    { type: "message", message: { role: "assistant", content: [{ type: "thinking", thinking: "obsolete intent" }] } },
    { type: "message", message: { role: "user", content: "review" } },
    { type: "message", message: { role: "assistant", content: [
      { type: "thinking", thinking: "check quiz schema", thinkingSignature: "opaque signature" },
      { type: "toolCall", name: "bash", arguments: { command: "ab read schema.ts" } },
    ] } },
    { type: "message", message: { role: "toolResult", content: "untrusted result body" } },
  ];
  const context = ingressContext({ sessionManager: { buildContextEntries: () => entries } } as any,
    "write " + "x".repeat(5000) + "; ab read schema.ts");
  for (const value of ["check quiz schema", "Tool request: bash", "; ab read schema.ts"]) expect(context).toContain(value);
  for (const value of ["obsolete intent", "opaque signature", "untrusted result body"]) expect(context).not.toContain(value);
});
