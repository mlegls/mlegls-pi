// Launch a parent-planned ready wave. No reading, routing, dependency graph, or retries.
import { call, workspace, startPi, OrcaError, type WorkerReceipt, type Terminal } from "./orca.ts";
import { resolve } from "node:path";
import { agent } from "./agents.ts";

export interface Assignment {
  handle: string;
  /** Self-contained task, including relevant context and coordination constraints. */
  prompt: string;
  /** Optional roster stance; execution comes from model and effort. */
  agent?: string;
  model: string;
  effort: string;
  base?: string;
}

export interface Options {
  /** Existing Orca Run ID, not a free-form topic prefix. */
  run: string;
  from?: string;
  cwd?: string;
  /** Parent-scoped budget, including active handles, on either backend. */
  maxConcurrent: number;
  /** All still-outstanding workers supervised by this parent, across waves. */
  active: Handle[];
}

export type Handle = { backend: "orca"; handle: string; worktreeId: string; path: string; receipt: WorkerReceipt & { clientTerminal: Terminal } };

export interface Receipt {
  launched: Handle[];
  /** Backend failure can leave resources behind. Inspect before retrying this assignment. */
  failed?: { assignment: Assignment; error: string; receipt?: unknown };
  /** Never attempted (capacity or earlier failure); parent decides when to submit later. */
  pending: Assignment[];
}

/** Submit a ready wave; no automatic wait or retry for assignments beyond capacity. */
export async function dispatch(assignments: Assignment[], options: Options): Promise<Receipt> {
  const cwd = resolve(options.cwd ?? process.cwd());
  if (!/^run_[A-Za-z0-9]+$/.test(options.run)) throw new Error("dispatch: invalid run");
  if (!Number.isSafeInteger(options.maxConcurrent) || options.maxConcurrent < 1)
    throw new Error("dispatch: positive maxConcurrent required");
  if (!Array.isArray(options.active) || options.active.some(handle => handle.backend !== "orca"))
    throw new Error("dispatch: active must contain this backend's outstanding handles (use [] for the first wave)");
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

  for (const [index, { task, stance }] of prepared.entries()) {
    if (active.length + receipt.launched.length >= options.maxConcurrent) {
      receipt.pending = prepared.slice(index).map(item => item.task);
      break;
    }
    try {
      const text = [stance?.body, task.prompt].filter(Boolean).join("\n\n---\n\n");
      const created = await call<{ worktree: { id: string; path: string } }>([
        "worktree", "create", "--name", options.run + "-" + task.handle,
        "--parent-worktree", workspace(cwd), "--setup", "run",
        ...(task.base ? ["--base-branch", task.base] : [])], cwd);
      const worktree = created.worktree;
      if (!worktree?.id || !worktree.path) throw new Error("dispatch: invalid worktree receipt " + JSON.stringify(created));
      try {
        const launched = await startPi({ spec: text, taskTitle: task.handle, run: options.run, from: options.from,
          model: task.model, effort: task.effort, cwd, worktree: "id:" + worktree.id });
        receipt.launched.push({ backend: "orca", handle: task.handle, receipt: launched, worktreeId: worktree.id, path: worktree.path });
      } catch (error) {
        throw new OrcaError("Worktree retained at " + worktree.path + ": " + String(error),
          { worktree, cause: error instanceof OrcaError ? error.receipt : String(error) });
      }
    } catch (error) {
      receipt.failed = { assignment: task, error: error instanceof Error ? error.message : String(error), receipt: error instanceof OrcaError ? error.receipt : undefined };
      receipt.pending = prepared.slice(index + 1).map(item => item.task);
      break;
    }
  }
  return receipt;
}
