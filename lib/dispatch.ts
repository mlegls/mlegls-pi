// Launch a parent-planned ready wave. No reading, routing, dependency graph, or retries.
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { agent } from "./agents.ts";
import type { Worker } from "./wm.ts";

export interface Assignment {
  handle: string;
  /** Self-contained task, including relevant context and coordination constraints. */
  prompt: string;
  /** Optional roster stance; its legacy runCommand does not select execution. */
  agent?: string;
  model: string;
  effort: string;
  base?: string;
}

export interface Options {
  run: string;
  cwd?: string;
  /** Workmux: parent-scoped budget, including active handles. BB uses native limits. */
  maxConcurrent?: number;
  /** Workmux: all still-outstanding workers supervised by this parent, across waves. */
  active?: Handle[];
}

export type Handle =
  | { backend: "bb"; handle: string; id: string; environmentId: string; status: string }
  | { backend: "wm"; handle: string; worker: Worker };

export interface Receipt {
  launched: Handle[];
  /** Backend failure can leave resources behind. Inspect before retrying this assignment. */
  failed?: { assignment: Assignment; error: string };
  /** Never attempted (capacity or earlier failure); parent decides when to submit later. */
  pending: Assignment[];
}

function bb(args: string[], cwd: string, input?: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn("bb", args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.stdin.on("error", reject);
    child.on("close", code => {
      if (code !== 0) return reject(new Error("bb failed (" + code + "): " + (stderr || stdout)));
      try { resolve(JSON.parse(stdout)); } catch { reject(new Error("Invalid bb JSON: " + stdout)); }
    });
    child.stdin.end(input);
  });
}

const quote = (text: string) => "'" + text.replaceAll("'", "'\"'\"'") + "'";

/** Submit a ready wave; no automatic wait or retry for assignments beyond capacity. */
export async function dispatch(assignments: Assignment[], options: Options): Promise<Receipt> {
  const parent = process.env.BB_THREAD_ID;
  const cwd = resolve(options.cwd ?? process.cwd());
  if (!/^[A-Za-z0-9][A-Za-z0-9_/-]*$/.test(options.run)) throw new Error("dispatch: invalid run");
  if (parent && (options.maxConcurrent !== undefined || options.active !== undefined))
    throw new Error("dispatch: BB uses configured global/host limits; omit maxConcurrent/active");
  if (!parent && (!Number.isSafeInteger(options.maxConcurrent) || options.maxConcurrent! < 1))
    throw new Error("dispatch: workmux requires a positive maxConcurrent");
  if (!parent && (!Array.isArray(options.active) || options.active.some(handle => handle.backend !== "wm")))
    throw new Error("dispatch: workmux requires active handles (use [] for the first wave)");
  const active = [...(options.active ?? [])];
  const names = new Set(active.map(handle => handle.handle));
  // Validate and snapshot the entire wave before any launch.
  const prepared = assignments.map(input => {
    const task = { ...input };
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(task.handle) || names.has(task.handle))
      throw new Error("dispatch: invalid or duplicate handle " + task.handle);
    names.add(task.handle);
    if (!task.prompt?.trim() || !/^[^\s/]+\/[^\s]+$/.test(task.model) ||
        !["off", "none", "minimal", "low", "medium", "high", "xhigh", "max"].includes(task.effort))
      throw new Error("dispatch: prompt, provider/model and effort required for " + task.handle);
    if (task.agent !== undefined && !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(task.agent))
      throw new Error("dispatch: invalid agent name");
    const stance = task.agent ? agent(task.agent) : undefined;
    if (task.agent && !stance) throw new Error("dispatch: unknown agent " + task.agent);
    return { task, stance };
  });
  const receipt: Receipt = { launched: [], pending: [] };
  if (!prepared.length) return receipt;

  // BB context is read-only preflight; explicit project/host prevents remembered defaults drifting.
  let projectId: string | undefined, hostId: string | undefined;
  if (parent) {
    const context = await bb(["thread", "show", parent, "--json"], cwd) as {
      thread?: { projectId?: string; environmentId?: string };
      environment?: { hostId?: string };
    };
    projectId = context.thread?.projectId;
    const environmentId = context.thread?.environmentId;
    if (!projectId || !environmentId) throw new Error("dispatch: parent needs a project and environment");
    hostId = context.environment?.hostId;
    if (!hostId) throw new Error("dispatch: parent environment host unavailable");
  }

  for (const [index, { task, stance }] of prepared.entries()) {
    if (!parent && active.length + receipt.launched.length >= options.maxConcurrent!) {
      receipt.pending = prepared.slice(index).map(item => item.task);
      break;
    }
    try {
      if (parent) {
        const text = [stance?.body, task.prompt,
          "You are " + task.handle + " in run " + options.run + ". Parent: @thread:" + parent + ". " +
          "Report by ending your turn with done, blocked, needs-input, or checkpoint on the first line. " +
          "Use bb thread tell for coordination; commit changes for the parent to merge."
        ].filter(Boolean).join("\n\n---\n\n");
        const args = ["thread", "spawn", "--project", projectId!, "--machine", hostId!,
          "--parent-thread", parent, "--new-environment", "worktree", "--provider", "pi",
          "--model", task.model, "--reasoning-level", task.effort, "--title", options.run + "/" + task.handle,
          "--prompt-file", "-", "--json"];
        if (task.base) args.push("--base-branch", task.base);
        const thread = await bb(args, cwd, text) as { id?: string; environmentId?: string; status?: string };
        if (!thread.id || !thread.environmentId || !thread.status)
          throw new Error("dispatch: incomplete spawn receipt: " + JSON.stringify(thread));
        receipt.launched.push({ backend: "bb", handle: task.handle, id: thread.id,
          environmentId: thread.environmentId, status: thread.status });
      } else {
        const wm = await import("./wm.ts");
        const worker = await wm.spawn({ run: options.run, handle: task.handle, prompt: task.prompt,
          agent: task.agent, base: task.base, cwd,
          command: "pi --model " + quote(task.model) + " --thinking " + quote(task.effort) + " --tools exec,ls" });
        receipt.launched.push({ backend: "wm", handle: task.handle, worker });
      }
    } catch (error) {
      receipt.failed = { assignment: task, error: error instanceof Error ? error.message : String(error) };
      receipt.pending = prepared.slice(index + 1).map(item => item.task);
      break;
    }
  }
  return receipt;
}
