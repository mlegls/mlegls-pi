// Thin native CLI boundary. No scheduler, enrollment, or mailbox state.
import { execFile } from "node:child_process";

export class PaseoError extends Error {
  constructor(message: string, readonly receipt: unknown) { super(message); this.name = "PaseoError"; }
}

/** Raw native JSON; failures retain output even when creation's outcome is unknown. */
export function call<T = unknown>(args: string[], cwd = process.cwd()): Promise<T> {
  return new Promise((resolve, reject) => {
    const separator = args.indexOf("--");
    const argv = separator < 0 ? [...args, "--json"] : [...args.slice(0, separator), "--json", ...args.slice(separator)];
    execFile(process.env.PASEO_CLI || "paseo", argv,
      { cwd, timeout: 60_000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
        let data: unknown;
        try { data = JSON.parse(stdout); } catch { /* retain raw output below */ }
        if (error || data === undefined) return reject(new PaseoError(
          "paseo " + args.slice(0, 2).join(" ") + ": " + (error?.message || "invalid JSON"),
          { args, stdout, stderr, data, error: error?.message }));
        resolve(data as T);
      });
  });
}

export interface Workspace { workspaceId: string; cwd: string; isolation: string }
export interface Agent { agentId: string; cwd: string; status: string; provider: string }
export interface Launch { workspace: Workspace; agent: Agent }

export async function launch(task: { handle: string; model: string; effort: string; base?: string },
    text: string, options: { run: string; cwd: string }): Promise<Launch> {
  let workspace: Workspace | undefined;
  let result: unknown;
  try {
    result = await call<Workspace>(["workspace", "create", "--isolation", "worktree",
      "--path", options.cwd, "--mode", "branch-off", "--new-branch", options.run + "/" + task.handle,
      ...(task.base ? ["--base", task.base] : [])], options.cwd);
    workspace = result as Workspace;
    if (!workspace?.workspaceId || !workspace.cwd || workspace.isolation !== "worktree")
      throw new Error("incomplete workspace receipt");
    result = await call<Agent>(["run", "--background", "--workspace", workspace.workspaceId,
      "--provider", "pi", "--model", task.model, "--thinking", task.effort === "none" ? "off" : task.effort,
      "--title", options.run + "/" + task.handle, "--", text], options.cwd);
    const agent = result as Agent;
    if (!agent?.agentId || !agent.cwd || !["created", "running"].includes(agent.status) || agent.provider !== "pi")
      throw new Error("incomplete or unsuccessful agent receipt");
    return { workspace, agent };
  } catch (error) {
    throw new PaseoError("Paseo launch uncertain; inspect retained resources before retrying: " + String(error),
      { workspace, result, cause: error instanceof PaseoError ? error.receipt : String(error) });
  }
}
