import { writeFileSync, renameSync } from "node:fs";
import { SessionManager, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { terminal, workspace, piCommand, call, inOrca } from "../../lib/orca.ts";

export default function (pi: ExtensionAPI) {
  let statusTimer: ReturnType<typeof setInterval> | undefined;
  let statusGeneration = 0;
  let address: string | undefined;
  let ready: Promise<void> = Promise.resolve();
  const stopStatus = () => {
    statusGeneration++;
    clearInterval(statusTimer);
    statusTimer = undefined;
    address = undefined;
  };
  const startStatus = (ctx: ExtensionContext) => {
    stopStatus();
    ctx.ui.setStatus("orca-run", undefined);
    const handle = process.env.ORCA_TERMINAL_HANDLE;
    if (!inOrca() || !ctx.hasUI || !handle) return;
    const generation = statusGeneration;
    let pending = false;
    let creationAttempted = false;
    let warned = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        let { run } = await call<{ run: { id: string } | null }>(
          ["orchestration", "run-current"], ctx.cwd, 5_000,
        );
        let nextAddress = run ? "run:" + run.id : undefined;
        if (!run) {
          // A worker may have no coordinator binding. Inspect its Dispatch before
          // creating a mailbox; the launch token also covers pre-enrollment startup.
          let cursor: string | undefined;
          do {
            const result = await call<{
              workers: { agentTerminalHandle: string; dispatchId: string; dispatchStatus: string }[];
              page: { hasMore: boolean; nextCursor?: string };
            }>(["orchestration", "worker-list", ...(cursor ? ["--cursor", cursor] : [])], ctx.cwd, 5_000);
            const worker = result.workers.find(w => w.agentTerminalHandle === handle &&
              ["pending", "dispatched"].includes(w.dispatchStatus));
            if (worker) { nextAddress = "dispatch:" + worker.dispatchId; break; }
            cursor = result.page.hasMore ? result.page.nextCursor : undefined;
          } while (cursor);
          if (!nextAddress && !process.env.PI_ORCA_START_TOKEN && !creationAttempted && generation === statusGeneration) {
            // Never retry a mutation with an unknown outcome. Subsequent polls
            // may discover its binding, but cannot create another Run.
            creationAttempted = true;
            ({ run } = await call<{ run: { id: string } }>(["orchestration", "run-create",
              "--objective", "Interactive Pi: " + (ctx.sessionManager.getSessionName() || ctx.cwd)], ctx.cwd, 5_000));
            nextAddress = "run:" + run.id;
          }
        }
        if (generation === statusGeneration) {
          address = nextAddress;
          ctx.ui.setStatus("orca-run", address ? ctx.ui.theme.fg("dim", address) : undefined);
        }
      } catch (error) {
        if (generation === statusGeneration) {
          address = undefined;
          ctx.ui.setStatus("orca-run", ctx.ui.theme.fg("dim", "orca: unavailable"));
          if (!warned) ctx.ui.notify("Orca address unavailable: " + String(error), "warning");
          warned = true;
        }
      } finally { pending = false; }
    };
    ready = refresh();
    statusTimer = setInterval(() => { if (!pending) ready = refresh(); }, 10_000);
    statusTimer.unref();
  };
  pi.on("session_start", (_event, ctx) => startStatus(ctx));
  pi.on("session_shutdown", stopStatus);
  pi.on("before_agent_start", async (event) => {
    await ready;
    if (address) return { systemPrompt: event.systemPrompt + "\n\nOrca messaging address for this terminal: " + address +
      ". Other sessions can send here with orca.send({to: " + JSON.stringify(address) +
      ", subject, body}). Read incoming mail with orca.check(); acknowledge only after processing. Mail wake-up is best effort." };
  });
  pi.registerCommand("orca-address", {
    description: "Show this session's copyable Orca messaging address",
    handler: async (_args, ctx) => {
      await ready;
      if (!address) { ctx.ui.notify("No Orca address available for this session", "warning"); return; }
      pi.sendMessage({ customType: "orca-address", content: address, display: true }, { triggerTurn: false });
    },
  });

  // Native tui-idle can precede Pi's extension/input initialization.
  const readyPath = process.env.PI_ORCA_READY_EVIDENCE;
  if (readyPath) pi.on("session_start", () => {
    writeFileSync(readyPath + ".tmp", JSON.stringify({ event: "session_start" }), { mode: 0o600 });
    renameSync(readyPath + ".tmp", readyPath);
  });
  const evidencePath = process.env.PI_ORCA_START_EVIDENCE;
  const token = process.env.PI_ORCA_START_TOKEN;
  const task = process.env.PI_ORCA_START_TASK;
  if (evidencePath && token) pi.on("before_agent_start", (event, ctx) => {
    if (!event.prompt.includes("[Pi launch correlation: " + token + "]") &&
        !(task && event.prompt.includes(task))) return;
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
