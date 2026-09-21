import { writeFileSync, renameSync } from "node:fs";
import { SessionManager, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { terminal, workspace, piCommand, call, inOrca } from "../../lib/orca.ts";

export default function (pi: ExtensionAPI) {
  let statusTimer: ReturnType<typeof setInterval> | undefined;
  let statusGeneration = 0;
  const stopStatus = () => {
    statusGeneration++;
    clearInterval(statusTimer);
    statusTimer = undefined;
  };
  const startStatus = (ctx: ExtensionContext) => {
    stopStatus();
    ctx.ui.setStatus("orca-run", undefined);
    if (!inOrca() || !ctx.hasUI) return;
    const generation = statusGeneration;
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const { run } = await call<{ run: { id: string } | null }>(
          ["orchestration", "run-current"], ctx.cwd, 5_000,
        );
        if (generation === statusGeneration)
          ctx.ui.setStatus("orca-run", run ? ctx.ui.theme.fg("dim", "orca: " + run.id) : undefined);
      } catch {
        if (generation === statusGeneration) ctx.ui.setStatus("orca-run", undefined);
      } finally { pending = false; }
    };
    void refresh();
    statusTimer = setInterval(refresh, 10_000);
    statusTimer.unref();
  };
  pi.on("session_start", (_event, ctx) => startStatus(ctx));
  pi.on("session_switch", (_event, ctx) => startStatus(ctx));
  pi.on("session_shutdown", stopStatus);

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
