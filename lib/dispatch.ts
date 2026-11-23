// Launch a parent-planned ready wave as wm workers. No dependency graph or retries.
import { execFile, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { agent } from "./agents.ts";
import { parseAssignee } from "./assignee.ts";
import { integrateThread, workerOf, ThreadMergeConflict, type ThreadCleanup, type WorkerThread } from "./thread";
import { bbThreads, bbWorkerThread, tellBb } from "./thread/bb.ts";
import { CommitHookFailure } from "./thread/commit-hooks";
import { commonDir } from "./thread/git.ts";
import { HANDOFF_KEYS } from "./report.ts";
import { stopThreadProcesses } from "./thread/lifecycle-cleanup";
import type { SpawnOptions } from "./wm";

export interface Assignment {
  handle: string;
  /** Tracker identity requires explicit eligibility; never inherit from a parent. */
  issue?: string;
  assignee?: string;
  /** Self-contained task, including relevant context and coordination constraints. */
  prompt: string;
  /** Roster stance (agents/<agent>.md): its prompt and ordered model list. */
  agent?: string;
  /** Which of the agent's roles this assignment fills (agents/roles/); default its first. */
  role?: string;
  /** Exact provider/model and effort; default to the agent's model list. */
  model?: string;
  effort?: string;
  base?: string;
  /** Library-only HEAD of a saved launch worktree verified by the reconciler. */
  adoptHead?: string;
  /** Library-only retry cursor: choose an entry after the rate-limited route. */
  after?: SpawnOptions["after"];
  /** Library-only preparation in the new checkout, before setup/launch; may replace the task prompt. */
  prepare?: (cwd: string) => Promise<string | void>;
}

export interface Options {
  /** Parent topic/branch prefix. */
  run: string;
  cwd?: string;
  /** BB thread recorded as the caller in the dispatch ledger; default BB_THREAD_ID. */
  parent?: string;
  /** Explicit bb parent, independent of the process that happens to launch the worker. */
  parentThread?: string;
  /** Library-only owner selection around bb creation; preparation remains outside. */
  withOwner?: SpawnOptions["withOwner"];
  /** Library-only issue reservation for auxiliary phases that do not claim the issue's assignment. */
  protectedIssue?: string;
  /** Parent-scoped budget, including active handles. */
  maxConcurrent: number;
  /** All still-outstanding workers supervised by this parent, across waves. */
  active: Handle[];
  /** Legacy receipt field; never selects a terminal transport. */
  session?: string;
}

/** A tracker issue's `assignee` must admit the launch: `agent` admits any agent, `agent:<stance>` that
 * stance, `model:<provider/model>:<effort>` that exact execution (comma-separated pins combine). Human and
 * session assignees, and an issue without an assignee, are never dispatched automatically. */
export function assertAssignee(task: Assignment) {
  if (!task.issue && !Object.hasOwn(task, "assignee")) return;
  const selector = task.assignee;
  if (selector == null) throw new Error("dispatch: unassigned work cannot be automatically dispatched (" + task.handle + ")");
  const parsed = parseAssignee(selector);
  if (!parsed) throw new Error("dispatch: invalid assignee " + JSON.stringify(selector));
  if (parsed.kind !== "agent") throw new Error("dispatch: " + task.handle + " is assigned to " + selector);
  const { stance, pin } = parsed;
  if (stance && task.agent !== stance) throw new Error("dispatch: " + task.handle + " is assigned to agent:" + stance + ", not agent " + task.agent);
  if (pin && (task.model !== pin.model || task.effort !== pin.effort))
    throw new Error("dispatch: " + task.handle + " is pinned to model:" + pin.model + ":" + pin.effort);
}

/** A submitted worker. Plain data, so it survives being persisted (supervision state); reattach with wm.attach(run, handle). */
export interface Handle {
  handle: string; run: string; path: string;
  /** The worker's bb thread: how everything finds it. Absent on a receipt from before run state held it. */
  bb?: string;
  /** Legacy receipt field; never selects a terminal transport. */
  session?: string;
}
/** The worker's run/handle label. */
export const topic = (h: Handle) => h.run + "/" + h.handle;

export interface Receipt {
  submitted: Handle[];
  /** Backend failure can leave resources behind. Inspect before retrying this assignment. */
  failed?: { assignment: Assignment; error: string; receipt?: unknown };
  /** Never attempted (capacity or earlier failure); parent decides when to submit later. */
  pending: Assignment[];
}

/** Each submitted worker leaves a record under the repository's git dir, so the tracker shows the issue it
 * works on as in flight (the tracker skill's inflight script) while its branch has not merged. The issue is the
 * assignment's, else the first issue file or wikilink its prompt names. Records whose worktree is gone are ignored. */
const ledgerFile = (cwd: string, run: string, handle: string) => join(
  execFileSync("git", ["-C", cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim(),
  "ab-dispatch", (run + "-" + handle).replace(/[^A-Za-z0-9_-]/g, "-") + ".json");
function ledger(cwd: string, task: Assignment, run: string, handle: Handle, parent?: string) {
  try {
    const issue = task.issue ?? task.prompt.match(/issues\/(?!archive\/)([a-z0-9][a-z0-9-]*)(?:\.md|\]\]|\|)/)?.[1];
    const file = ledgerFile(cwd, run, task.handle);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({
      run, handle: task.handle, bb: handle.bb, issue: issue ?? null, path: handle.path, parent: parent ?? null,
      agent: task.agent ?? null, at: new Date().toISOString() }, null, 1));
  } catch {}
}

/** Submit a ready wave; no automatic wait or retry for assignments beyond capacity. */
export async function dispatch(assignments: Assignment[], options: Options): Promise<Receipt> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const parent = options.parent ?? options.parentThread ?? process.env.BB_THREAD_ID;
  if (options.parent !== undefined && !options.parent.trim()) throw new Error("dispatch: parent must not be empty");
  if (typeof options.run !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_/-]*$/.test(options.run)) throw new Error("dispatch: invalid run");
  if (!Number.isSafeInteger(options.maxConcurrent) || options.maxConcurrent < 1)
    throw new Error("dispatch: positive maxConcurrent required");
  if (!Array.isArray(options.active))
    throw new Error("dispatch: active must list the outstanding handles (use [] for the first wave)");
  const active = [...(options.active ?? [])];
  const names = new Set(active.map(handle => handle.handle));
  // Validate and snapshot the entire wave before any launch.
  const prepared = assignments.map(input => {
    const task = { ...input };
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(task.handle) || names.has(task.handle))
      throw new Error("dispatch: invalid or duplicate handle " + task.handle);
    names.add(task.handle);
    if (!task.model && task.agent) task.model = "stance/" + task.agent;
    task.effort ??= task.model?.startsWith("stance/") ? "medium" : undefined;
    if (!task.prompt?.trim() || !task.model || !/^[^\s/]+\/[^\s]+$/.test(task.model) || !task.effort ||
        !["off", "none", "minimal", "low", "medium", "high", "xhigh", "max"].includes(task.effort))
      throw new Error("dispatch: prompt and an agent, or provider/model and effort, required for " + task.handle);
    if (task.agent !== undefined && !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(task.agent))
      throw new Error("dispatch: invalid agent name");
    assertAssignee(task);
    const stance = task.agent ? agent(task.agent) : undefined;
    if (task.agent && !stance) throw new Error("dispatch: unknown agent " + task.agent);
    return task;
  });
  const receipt: Receipt = { submitted: [], pending: [] };
  if (!prepared.length) return receipt;

  for (const [index, task] of prepared.entries()) {
    if (active.length + receipt.submitted.length >= options.maxConcurrent) {
      receipt.pending = prepared.slice(index);
      break;
    }
    try {
      let ownerThread = parent;
      const wm = await import("./wm.ts");
      const worker = await wm.spawn({ run: options.run, handle: task.handle, issue: task.issue ?? options.protectedIssue, prompt: task.prompt,
        agent: task.agent, role: task.role, base: task.base, adoptHead: task.adoptHead, prepare: task.prepare, model: task.model, effort: task.effort, after: task.after, cwd, parentThread: options.parentThread, session: options.session,
        withOwner: options.withOwner ? create => options.withOwner!(owner => { ownerThread = owner.thread; return create(owner); }) : undefined });
      receipt.submitted.push({ handle: task.handle, run: options.run, path: worker.dir, bb: worker.bb });
      ledger(cwd, task, options.run, receipt.submitted.at(-1)!, ownerThread);
    } catch (error) {
      receipt.failed = { assignment: task, error: error instanceof Error ? error.message : String(error) };
      receipt.pending = prepared.slice(index + 1);
      break;
    }
  }
  return receipt;
}

/** Merge a settled worker's branch into the parent checkout, then retire its host resources.
 * Uncommitted work, authored tracker changes and failed commit hooks refuse; ordinary conflicts abort. Optional prepare runs on the child after
 * rebase (or before a merge-mode merge), before touching the parent; it must leave clean commits.
 * keep leaves cleanup to the caller, e.g. after persisting supervision state. */
export class MergeConflict extends Error {
  constructor(readonly branch: string, readonly files: string[]) { super("conflicts merging " + branch + ": " + files.join(", ")); this.name = "MergeConflict"; }
}
export interface Integration { branch: string; mode: "rebase" | "merge"; output?: string; removed?: unknown; killed?: number[]; branchDeleted?: string; branchKept?: string;
  /** Retirement found no live worker (its bb thread archived or gone): nothing was stopped or removed, and this worktree, if
   * it still exists, is left as it is, ignored state and all. */
  gone?: { worktree?: string } }

/** A worker's bb thread: the receipt's own, else the live bb thread titled `<run>/<handle>` in cwd's repository, which finds
 * a worker spawned just before a crash that run state never recorded. A bare handle names the one such worker in any run. */
export async function findWorker(given: (Pick<Handle, "run" | "handle"> & Partial<Handle>) | string, cwd: string): Promise<{ bb: string; path: string } | undefined> {
  if (typeof given !== "string") {
    if (given.bb) return { bb: given.bb, path: resolve(given.path ?? cwd) };
  }
  const repo = commonDir(cwd);
  const found = bbWorkerThread(await bbThreads(), typeof given === "string" ? given : given.handle, typeof given === "string" ? undefined : given.run,
    path => !repo || !commonDir(path) || commonDir(path) === repo);
  if (!found) return undefined;
  if (typeof given !== "string" && given.path && resolve(given.path) !== resolve(found.environmentPath!)) throw new Error("Receipt does not match bb thread " + found.id);
  return { bb: found.id, path: resolve(found.environmentPath!) };
}

/** The worker's live thread, found through run state or bb; undefined once its bb thread is archived or gone. */
async function liveRecord(given: Handle | string, cwd: string): Promise<{ worker: Handle; thread: WorkerThread } | undefined> {
  const found = await findWorker(given, cwd);
  const thread = found ? await workerOf(found.bb, typeof given === "string" ? undefined : { run: given.run, handle: given.handle }) : undefined;
  if (!thread) return undefined;
  if (typeof given !== "string" && thread.cwd !== realpathSync(given.path)) throw new Error("Receipt does not match thread " + thread.id);
  return { thread, worker: { ...(typeof given === "string" ? {} : given), ...thread.worker, path: thread.cwd, bb: thread.id } };
}
async function recordOf(given: Handle | string, cwd: string): Promise<{ worker: Handle; thread: WorkerThread }> {
  const record = await liveRecord(given, cwd);
  if (!record) throw new Error("No live worker " + (typeof given === "string" ? given : topic(given)));
  return record;
}

/** Message a worker's bb thread, queued behind its turn in progress. */
export async function tell(given: Handle | string, text: string, options: { cwd?: string } = {}): Promise<void> {
  const found = await findWorker(given, resolve(options.cwd ?? process.cwd()));
  if (!found) throw new Error("No live worker " + (typeof given === "string" ? given : topic(given)));
  await tellBb(found.bb, text);
}

export async function integrate(given: Handle | string,
    options: { cwd?: string; mode?: "rebase" | "merge"; keep?: boolean; prepare?: (worker: Handle) => Promise<void>; notifyHookFailure?: boolean } = {}): Promise<Integration> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const { worker, thread } = await recordOf(given, cwd);
  const mode = options.mode ?? "rebase";
  let branch: string, output: string | undefined;
  try {
    const integrated = await integrateThread(thread.id, { mode, prepare: options.prepare ? async () => options.prepare!(worker) : undefined });
    branch = integrated.branch;
    output = integrated.output;
  } catch (error) {
    if (error instanceof ThreadMergeConflict) throw new MergeConflict(error.branch, error.files);
    if (error instanceof CommitHookFailure && options.notifyHookFailure !== false) {
      try { await tellBb(thread.id, error.message); }
      catch (delivery) { error.message += "\nCould not queue the follow-up: " + delivery; }
    }
    throw error;
  }
  const result: Integration = { branch, mode, ...(output ? { output } : {}) };
  if (options.keep) return result;
  return Object.assign(result, await retire(worker, { cwd }));
}

/** Stop a superseded worker's services without deleting partial work needed by its replacement. A worker whose bb thread
 * is archived or gone is already stopped: 2026-10-30 (concept, link-charted-missions-to-the-copy-they-chart) a review
 * worker's thread disappeared, and every relaunch, and reconcile_stop, failed here with "No live worker". */
export async function stop(given: Handle | string, options: { cwd?: string } = {}): Promise<ThreadCleanup> {
  const record = await liveRecord(given, resolve(options.cwd ?? process.cwd()));
  if (!record) return { closed: [], killed: [], branchesDeleted: [], branchesKept: [] };
  return stopThreadProcesses(record.thread);
}

/** Retire through lifecycle, then delete only patches already in the recorded ab-parent. A worker with no live bb thread
 * was retired already, or lost its thread: its worktree (with its ignored state) and branch are left for the owner. */
export async function retire(given: Handle | string, options: { cwd?: string } = {}): Promise<Omit<Integration, "branch" | "mode">> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const record = await liveRecord(given, cwd);
  if (!record) {
    const path = typeof given === "string" ? undefined : given.path && resolve(given.path);
    return { killed: [], gone: path && existsSync(path) ? { worktree: path } : {} };
  }
  const { worker, thread } = record;
  const git = (...args: string[]) => new Promise<{ code: number; out: string; err: string }>(done =>
    execFile("git", ["-C", thread.project, ...args], (error, out, err) => done({ code: typeof (error as any)?.code === "number" ? (error as any).code : error ? 1 : 0, out: out.trim(), err: err.trim() })));
  const result: Awaited<ReturnType<typeof retire>> = {};
  const wm = await import("./wm.ts");
  const host = wm.attach(worker.run, worker.handle, cwd, worker.session, thread.id);
  try { result.removed = await host.close(true); } finally { host.drop(); }
  // Its in-flight record goes with the thread; a kept branch still shows in the tracker as a branch ahead.
  try { rmSync(ledgerFile(thread.project, worker.run, worker.handle), { force: true }); } catch {}
  result.killed = (result.removed as { killed?: number[] } | undefined)?.killed ?? [];
  const branch = thread.branch;
  const parent = await git("config", "--get", "branch." + branch + ".ab-parent");
  const cherry = parent.code || !parent.out ? { code: 1, out: "", err: "missing ab-parent" } : await git("cherry", parent.out, branch);
  const merged = !cherry.code && !cherry.out.split("\n").some(line => line.startsWith("+"));
  const deleted = merged ? await git("branch", "-D", branch) : { code: 1, out: "", err: cherry.err || "not merged into " + parent.out };
  if (deleted.code) result.branchKept = branch + ": " + (deleted.err || deleted.out); else result.branchDeleted = branch;
  return result;
}
