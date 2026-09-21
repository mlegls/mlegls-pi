import { writeFileSync, renameSync } from "node:fs";
import { SessionManager, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { terminal, workspace, piCommand, call } from "../../lib/orca.ts";

export default function (pi: ExtensionAPI) {
  const evidencePath = process.env.PI_ORCA_START_EVIDENCE;
  const token = process.env.PI_ORCA_START_TOKEN;
  if (evidencePath && token) pi.on("before_agent_start", (event, ctx) => {
    if (!event.prompt.includes("[Pi launch correlation: " + token + "]")) return;
    try {
      writeFileSync(evidencePath + ".tmp", JSON.stringify({ event: "before_agent_start", at: new Date().toISOString(), session: ctx.sessionManager.getSessionFile() }), { mode: 0o600 });
      renameSync(evidencePath + ".tmp", evidencePath);
    } catch { /* Evidence failure must not prevent the assigned work. */ }
  });
  pi.registerCommand("fork-tab", {
    description: "Fork the current conversation into another Orca tab: /fork-tab [title]",
    handler: async (args, ctx) => {
      await ctx.waitForIdle();
      const source = ctx.sessionManager.getSessionFile();
      if (!source) { ctx.ui.notify("Forking requires a persisted session", "error"); return; }
      const target = workspace(ctx.cwd);
      // Read-only preflight before creating a fork; never use the currently focused workspace.
      await call(["worktree", "show", "--worktree", target], ctx.cwd);
      const fork = SessionManager.forkFrom(source, ctx.cwd);
      const leaf = ctx.sessionManager.getLeafId();
      if (leaf) fork.branch(leaf);
      else fork.resetLeaf();
      const file = fork.getSessionFile();
      if (!file) throw new Error("Pi did not persist the fork");
      const title = args.trim() || "Fork: " + (ctx.sessionManager.getSessionName() || "conversation");
      fork.appendSessionInfo(title);
      try {
        const tab = await terminal(piCommand(["--session", file]), title, ctx.cwd, target, true);
        ctx.ui.notify("Opened " + title + " (" + tab.handle + ")" + (tab.warning ? "\n" + tab.warning : ""), "info");
      } catch (error) {
        // Creation can succeed before the CLI loses its response. Keep the fork; do not retry automatically.
        ctx.ui.notify(String(error) + "\nFork retained: " + file + "\nInspect Orca before retrying.", "error");
      }
    },
  });
}
