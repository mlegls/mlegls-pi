// Orca owns terminals/worktrees; Pi owns sessions and the board owns coordination.
import { execFile } from "node:child_process";
import { resolve } from "node:path";

export const inOrca = (env: NodeJS.ProcessEnv = process.env): boolean => Boolean(env.ORCA_WORKTREE_ID || env.ORCA_WORKSPACE_ID);
export const quote = (text: string): string => "'" + text.replaceAll("'", "'\\''") + "'";
export function workspace(cwd = process.cwd()): string {
  return "path:" + resolve(cwd);
}
export async function call<T>(args: string[], cwd = process.cwd()): Promise<T> {
  return new Promise((resolve, reject) => {
    execFile(process.env.ORCA_CLI || process.env.ORCA_CLI_COMMAND || (process.env.ORCA_DEV_REPO_ROOT ? "orca-dev" : process.platform === "linux" && !inOrca() ? "orca-ide" : "orca"), [...args, "--json"], { cwd, timeout: 60_000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) return reject(new Error("orca " + args.slice(0, 2).join(" ") + ": " + (stderr || stdout || error.message)));
      try {
        const response = JSON.parse(stdout);
        if (!response.result || response.error) throw new Error("Invalid Orca receipt: " + stdout);
        resolve(response.result as T);
      } catch (error) { reject(error); }
    });
  });
}
export interface Terminal { handle: string; worktreeId: string; tabId?: string; warning?: string }
export async function terminal(command: string, title: string, cwd = process.cwd(), target = workspace(cwd), focus = false): Promise<Terminal> {
  const result = await call<{ terminal: Terminal }>(["terminal", "create", "--worktree", target, "--title", title,
    "--command", command, ...(focus ? ["--focus"] : [])], cwd);
  if (!result.terminal?.handle) throw new Error("Orca created no terminal handle: " + JSON.stringify(result));
  return result.terminal;
}
/** Stop the PTY. Orca may retain an orphan transcript; handles are not durable session IDs. */
export const stop = (handle: string) => call(["terminal", "close", "--terminal", handle]);
export const piCommand = (args: string[]) => [process.env.PI_ORCA_COMMAND || "pi", ...args.map(quote)].join(" ");
