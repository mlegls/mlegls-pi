import { executionHost } from "./execution-host.ts";
import * as paseo from "./paseo.ts";
import type { Worker } from "./wm.ts";
// Launch a parent-planned ready wave. No reading, routing, dependency graph, or retries.
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { agent } from "./agents.ts";
import { HANDOFF_KEYS } from "./report.ts";
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
  /** Parent topic/branch prefix. */
  run: string;
  cwd?: string;
  /** Owning Paseo agent; overrides PASEO_AGENT_ID and forces the Paseo host. */
  parent?: string;
  /** Parent-scoped budget, including active handles, on every backend. */
  maxConcurrent: number;
  /** All still-outstanding workers supervised by this parent, across waves. */
  active: Handle[];
  routing?: RouteOptions;
}

export type Handle =
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
  const parent = options.parent ?? process.env.PASEO_AGENT_ID;
  if (options.parent !== undefined && !options.parent.trim()) throw new Error("dispatch: parent must not be empty");
  const backend = options.parent === undefined ? executionHost() : "paseo";
  if (typeof options.run !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_/-]*$/.test(options.run)) throw new Error("dispatch: invalid run");
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
        ...(backend === "paseo" ? ["You are " + task.handle + "." + (parent ? " Parent agent ID: " + parent + "." : "") + " " +
          "End the turn with done, blocked, or needs-input as the first word. Do not send a terminal report or question mid-turn; for a question, finish with needs-input and the answer arrives as the next message. " +
          "When useful, include a fenced JSON or YAML handoff using these keys: " + HANDOFF_KEYS.join(", ") + ". " +
          "A missing status is an exception, not a guess. Commit changes for the parent to integrate; retain the workspace. " +
          "A completed turn is not assignment completion."] : [])].filter(Boolean).join("\n\n---\n\n");
      if (backend === "paseo") {
        const launched = await paseo.launch(task, text, { run: options.run, cwd, parent });
        receipt.submitted.push({ backend, handle: task.handle, agentId: launched.agent.agentId,
          workspaceId: launched.workspace.workspaceId, path: launched.workspace.cwd, receipt: launched });
        continue;
      }
      const wm = await import("./wm.ts");
      const worker = await wm.spawn({ run: options.run, handle: task.handle, prompt: task.prompt,
        agent: task.agent, base: task.base, model: task.model, effort: task.effort, cwd });
      receipt.submitted.push({ backend, handle: task.handle, path: worker.dir, worker });
    } catch (error) {
      receipt.failed = { assignment: task, error: error instanceof Error ? error.message : String(error), receipt: error instanceof paseo.PaseoError ? error.receipt : undefined };
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
export interface Integration { branch: string; mode: "rebase" | "merge"; removed?: unknown; killed?: number[]; branchDeleted?: string; branchKept?: string }
export async function integrate(worker: { backend: "paseo" | "wm"; workspaceId?: string; path: string; receipt?: paseo.Launch; worker?: Worker },
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
  return Object.assign(result, await retire(worker, { cwd, branch }));
}

type Retirable = Parameters<typeof integrate>[0];

/** Processes still running from inside a retired worktree: tmux servers behind term.spawn (kept per pi
 * session so they survive restarts), dev servers, watchers. Host archive does not reach them. Matched by
 * working directory, which lsof still reports after the directory is deleted. Never the parent checkout. */
async function killLeftovers(path: string, cwd: string): Promise<number[]> {
  const root = resolve(path);
  if (!root || root === "/" || cwd === root || cwd.startsWith(root + "/")) return [];
  const listing = await new Promise<string>(done => execFile("lsof", ["-d", "cwd", "-Fpn"], (_, out) => done(out ?? "")));
  const pids: number[] = [];
  let pid = 0;
  for (const line of listing.split("\n")) {
    if (line[0] === "p") pid = Number(line.slice(1));
    else if (line[0] === "n" && pid && pid !== process.pid && (line.slice(1) === root || line.slice(1).startsWith(root + "/"))) pids.push(pid);
  }
  for (const id of pids) try { process.kill(id, "SIGTERM"); } catch {}
  return pids;
}
/** Retire a worker's host resources, then delete its branch if all its patches are in HEAD.
 * An unmerged or still-checked-out branch is kept and reported in `branchKept`; that is not an error. */
export async function retire(worker: Retirable, options: { cwd?: string; branch?: string } = {}): Promise<Omit<Integration, "branch" | "mode">> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const git = (dir: string, ...args: string[]) => new Promise<{ code: number; out: string; err: string }>(done =>
    execFile("git", ["-C", dir, ...args], (error, out, err) => done({ code: (error as { code?: number } | null)?.code ?? 0, out: out.trim(), err: err.trim() })));
  const branch = options.branch ?? (await git(worker.path, "branch", "--show-current")).out;
  const result: Awaited<ReturnType<typeof retire>> = {};
  if (worker.backend === "paseo") {
    if (!worker.workspaceId) throw new Error("retire: Paseo workspaceId required for archive");
    result.removed = await paseo.archive(worker.workspaceId);
  } else if (worker.backend === "wm") {
    if (!worker.worker) throw new Error("retire: retained wm worker required for cleanup");
    result.removed = await worker.worker.close();
  } else throw new Error("retire: unknown backend " + String(worker.backend));
  result.killed = await killLeftovers(worker.path, cwd);
  if (branch) {
    await git(cwd, "worktree", "prune");
    // Rebase integration rewrites commits, so "merged" means every patch is upstream (git cherry), not ancestry.
    const cherry = await git(cwd, "cherry", "HEAD", branch);
    const merged = !cherry.code && !cherry.out.split("\n").some(line => line.startsWith("+"));
    const deleted = merged ? await git(cwd, "branch", "-D", branch) : { code: 1, out: "", err: "not merged into HEAD" };
    if (deleted.code) result.branchKept = branch + ": " + (deleted.err || deleted.out); else result.branchDeleted = branch;
  }
  return result;
}
