import { executionHost } from "./execution-host.ts";
import * as paseo from "./paseo.ts";
import type { Worker } from "./wm.ts";
// Launch a parent-planned ready wave. No reading, routing, dependency graph, or retries.
import { call, workspace, startPi, workers, OrcaError, type WorkerReceipt, type Terminal } from "./orca.ts";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { agent } from "./agents.ts";
import { assertAssignment, type RouteOptions } from "./route.ts";

export interface Assignment {
  handle: string;
  /** Tracker identity requires explicit eligibility; never inherit from a parent. */
  issue?: string;
  assignee?: string;
  /** Self-contained task, including relevant context and coordination constraints. */
  prompt: string;
  /** Optional roster stance; execution comes from model and effort. */
  agent?: string;
  model: string;
  effort: string;
  base?: string;
}

export interface Options {
  /** Parent topic/branch prefix; inside Orca, an existing Run ID. */
  run: string;
  from?: string;
  cwd?: string;
  /** Parent-scoped budget, including active handles, on every backend. */
  maxConcurrent: number;
  /** All still-outstanding workers supervised by this parent, across waves. */
  active: Handle[];
  routing?: RouteOptions;
}

export type OrcaHandle = { backend: "orca"; handle: string; worktreeId: string; path: string; receipt: WorkerReceipt & { clientTerminal: Terminal } };

export type Handle = OrcaHandle
  | { backend: "paseo"; handle: string; agentId: string; workspaceId: string; path: string; receipt: paseo.Launch }
  | { backend: "wm"; handle: string; path: string; worker: Worker };

export interface Receipt {
  submitted: Handle[];
  /** Backend failure can leave resources behind. Inspect before retrying this assignment. */
  failed?: { assignment: Assignment; error: string; receipt?: unknown };
  /** Never attempted (capacity or earlier failure); parent decides when to submit later. */
  pending: Assignment[];
}

/** Submit a ready wave; no automatic wait or retry for assignments beyond capacity. */
export async function dispatch(assignments: Assignment[], options: Options): Promise<Receipt> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const backend = executionHost();
  if (!(backend === "orca" ? /^run_[A-Za-z0-9]+$/ : /^[A-Za-z0-9][A-Za-z0-9_/-]*$/).test(options.run)) throw new Error("dispatch: invalid run");
  if (!Number.isSafeInteger(options.maxConcurrent) || options.maxConcurrent < 1)
    throw new Error("dispatch: positive maxConcurrent required");
  if (!Array.isArray(options.active) || options.active.some(handle => handle.backend !== backend))
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
    if (task.issue || Object.hasOwn(task, "assignee"))
      assertAssignment(task, { ...options.routing, assignee: task.assignee });
    const stance = task.agent ? agent(task.agent) : undefined;
    if (task.agent && !stance) throw new Error("dispatch: unknown agent " + task.agent);
    return { task, stance };
  });
  const receipt: Receipt = { submitted: [], pending: [] };
  if (!prepared.length) return receipt;

  for (const [index, { task, stance }] of prepared.entries()) {
    if (active.length + receipt.submitted.length >= options.maxConcurrent) {
      receipt.pending = prepared.slice(index).map(item => item.task);
      break;
    }
    try {
      const text = [stance?.body, task.prompt,
        ...(backend === "paseo" ? ["You are " + task.handle + ". Parent agent ID: " + process.env.PASEO_AGENT_ID + ". " +
          "Begin final output with done, blocked, or needs-input. Questions go to the parent via paseo send " +
          process.env.PASEO_AGENT_ID + " --no-wait <message>. Commit changes for the parent to integrate; retain the workspace. " +
          "A completed turn is not assignment completion."] : [])].filter(Boolean).join("\n\n---\n\n");
      if (backend === "paseo") {
        const launched = await paseo.launch(task, text, { run: options.run, cwd });
        receipt.submitted.push({ backend, handle: task.handle, agentId: launched.agent.agentId,
          workspaceId: launched.workspace.workspaceId, path: launched.workspace.cwd, receipt: launched });
        continue;
      }
      if (backend === "wm") {
        const wm = await import("./wm.ts");
        const worker = await wm.spawn({ run: options.run, handle: task.handle, prompt: task.prompt,
          agent: task.agent, base: task.base, model: task.model, effort: task.effort, cwd });
        receipt.submitted.push({ backend, handle: task.handle, path: worker.dir, worker });
        continue;
      }
      const created = await call<{ worktree: { id: string; path: string } }>([
        "worktree", "create", "--name", options.run + "-" + task.handle,
        "--parent-worktree", workspace(cwd), "--setup", "run",
        ...(task.base ? ["--base-branch", task.base] : [])], cwd);
      const worktree = created.worktree;
      if (!worktree?.id || !worktree.path) throw new Error("dispatch: invalid worktree receipt " + JSON.stringify(created));
      try {
        const submitted = await startPi({ spec: text, taskTitle: task.handle, run: options.run, from: options.from,
          model: task.model, effort: task.effort, agent: task.agent,
          ...(task.issue || Object.hasOwn(task, "assignee") ? { assignee: task.assignee } : {}), cwd, worktree: "id:" + worktree.id });
        receipt.submitted.push({ backend: "orca", handle: task.handle, receipt: submitted, worktreeId: worktree.id, path: worktree.path });
      } catch (error) {
        throw new OrcaError("Worktree retained at " + worktree.path + ": " + String(error),
          { worktree, cause: error instanceof OrcaError ? error.receipt : String(error) });
      }
    } catch (error) {
      receipt.failed = { assignment: task, error: error instanceof Error ? error.message : String(error), receipt: error instanceof OrcaError || error instanceof paseo.PaseoError ? error.receipt : undefined };
      receipt.pending = prepared.slice(index + 1).map(item => item.task);
      break;
    }
  }
  return receipt;
}

/** Merge a settled worker's branch into the parent checkout, then retire its host resources.
 * Uncommitted work in the worktree refuses; conflicts abort and throw with the conflicted files. */
export class MergeConflict extends Error {
  constructor(readonly branch: string, readonly files: string[]) { super("conflicts merging " + branch + ": " + files.join(", ")); this.name = "MergeConflict"; }
}
export interface Integration { branch: string; mode: "rebase" | "merge"; released?: unknown; closed?: unknown; removed?: unknown }
export async function integrate(worker: { backend?: "orca" | "paseo" | "wm"; worktreeId?: string; workspaceId?: string; path: string; receipt?: { dispatchId?: string } | paseo.Launch; worker?: Worker },
    options: { cwd?: string; mode?: "rebase" | "merge"; keep?: boolean } = {}): Promise<Integration> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const mode = options.mode ?? "rebase";
  const git = (dir: string, ...args: string[]) => new Promise<{ code: number; out: string; err: string }>(done =>
    execFile("git", ["-C", dir, ...args], (error, out, err) => done({ code: (error as { code?: number } | null)?.code ?? 0, out: out.trim(), err: err.trim() })));
  const conflicted = async (dir: string) => (await git(dir, "diff", "--name-only", "--diff-filter=U")).out.split("\n").filter(Boolean);
  const dirty = await git(worker.path, "status", "--porcelain");
  if (dirty.out) throw new Error("integrate: uncommitted changes in " + worker.path + "\n" + dirty.out);
  const branch = (await git(worker.path, "branch", "--show-current")).out;
  if (!branch) throw new Error("integrate: detached HEAD in " + worker.path);
  if (mode === "rebase") {
    const base = (await git(cwd, "rev-parse", "HEAD")).out;
    const rebase = await git(worker.path, "rebase", base);
    if (rebase.code) { const files = await conflicted(worker.path); await git(worker.path, "rebase", "--abort"); throw new MergeConflict(branch, files); }
    const ff = await git(cwd, "merge", "--ff-only", branch);
    if (ff.code) throw new Error("integrate: ff-only merge of " + branch + " failed: " + ff.err);
  } else {
    const merge = await git(cwd, "merge", "--no-ff", "--no-edit", branch);
    if (merge.code) { const files = await conflicted(cwd); await git(cwd, "merge", "--abort"); throw new MergeConflict(branch, files); }
  }
  const result: Integration = { branch, mode };
  if (options.keep) return result;
  if (worker.backend === "paseo") {
    if (!worker.workspaceId) throw new Error("integrate: Paseo workspaceId required for archive");
    result.removed = await paseo.call(["workspace", "archive", worker.workspaceId], cwd);
    return result;
  }
  if (worker.backend === "wm") {
    if (!worker.worker) throw new Error("integrate: retained wm worker required for cleanup");
    result.removed = await worker.worker.close();
    return result;
  }
  if (!worker.worktreeId) throw new Error("integrate: Orca worktreeId required for cleanup");
  if (worker.receipt && "dispatchId" in worker.receipt && worker.receipt.dispatchId)
    result.released = await workers.release(worker.receipt.dispatchId);
  const selector = "id:" + worker.worktreeId;
  result.closed = await call(["terminal", "close", "--worktree", selector, "--all"], cwd);
  result.removed = await call(["worktree", "rm", "--worktree", selector], cwd);
  return result;
}
