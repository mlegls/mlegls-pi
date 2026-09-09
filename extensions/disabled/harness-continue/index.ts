// harness-continue pi adapter TEMPLATE. `hc install pi` copies this into a
// pi package's extensions/harness-continue/index.ts, rewriting the import
// below to an absolute path (pi's extension loader resolves relative
// imports against the loaded location, so a symlink can't carry them back
// to this repo). Re-run install after editing this file.
//
// Transport-only, like the Claude Stop hook: the decision lives in
// src/gate.ts against the same .agents/continue.toml and armed state, so
// `hc on` in a terminal gates pi and Claude sessions identically — and
// headless runs too: a delegated `pi -p` job in an armed project keeps
// going until the gate passes (budget-bounded). LLM judges never load this
// (they run with -ne).
// Hook point: agent_settled — pi will not continue on its own past it —
// where a block becomes an injected user message that triggers a turn.
import { gateStop } from "/Users/mlegls/dev/harness-continue/src/gate.ts";

// Structural types instead of the pi package's ExtensionAPI: this file is
// resolved from the harness-continue repo, which doesn't depend on pi.
interface SettledCtx {
  cwd: string;
  isIdle?: () => boolean;
  sessionManager: { getSessionId(): string };
}

interface PiLike {
  sendUserMessage(content: string): void;
  on(event: "agent_settled", handler: (event: unknown, ctx: SettledCtx) => void | Promise<void>): void;
}

export default function (pi: PiLike) {
  pi.on("agent_settled", async (_event, ctx) => {
    const result = await gateStop({
      cwd: ctx.cwd,
      sessionKey: `pi-${ctx.sessionManager.getSessionId()}`,
      cli: "hc",
    }).catch(() => null); // gate errors must never wedge the session
    if (!result || result.action !== "block") return;
    // Another extension may have already resumed the agent; injecting is
    // only a "blocked stop" while the agent is actually settled.
    if (typeof ctx.isIdle === "function" && !ctx.isIdle()) return;
    pi.sendUserMessage(result.reason);
  });
}
