// Launch a parent-planned ready wave as wm workers. No reading, routing, dependency graph, or retries.
import { execFile, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { agent } from "./agents.ts";
import { allThreads, getThread, integrateThread, ThreadMergeConflict, workerThread, type ThreadRecord } from "./thread";
import { HANDOFF_KEYS } from "./report.ts";

export interface Assignment {
  handle: string;
  /** Tracker identity requires explicit eligibility; never inherit from a parent. */
  issue?: string;
  assignee?: string;
  /** Self-contained task, including relevant context and coordination constraints. */
  prompt: string;
  /** Roster stance (agents/<agent>.md): its prompt, and its model list through the `stance/<agent>` virtual model. */
  agent?: string;
  /** Which of the agent's roles this assignment fills (agents/roles/); default its first. */
  role?: string;
  /** Exact provider/model and effort; default `stance/<agent>`, which routes by the agent's model list. */
  model?: string;
  effort?: string;
  base?: string;
}

export interface Options {
  /** Parent topic/branch prefix. */
  run: string;
  cwd?: string;
  /** Owning pi session (spawn provenance and the ledger); default PI_SESSION_ID. */
  parent?: string;
  /** Parent-scoped budget, including active handles. */
  maxConcurrent: number;
  /** All still-outstanding workers supervised by this parent, across waves. */
  active: Handle[];
  /** Legacy receipt field; never selects a terminal transport. */
  session?: string;
  /** A run whose `decision` messages (on <follow>/**) each worker sees on its next turn, without waking. */
  follow?: string;
}

/** A tracker issue's `assignee` must admit the launch: `agent` admits any agent, `agent:<stance>` that
 * stance, `model:<provider/model>:<effort>` that exact execution (comma-separated pins combine). Human and
 * session assignees, and an issue without an assignee, are never dispatched automatically. */
export function assertAssignee(task: Assignment) {
  if (!task.issue && !Object.hasOwn(task, "assignee")) return;
  const selector = task.assignee?.trim();
  if (!selector) throw new Error("dispatch: unassigned work cannot be automatically dispatched (" + task.handle + ")");
  if (selector === "agent") return;
  if (selector === "human" || /^(user|session):/.test(selector))
    throw new Error("dispatch: " + task.handle + " is assigned to " + selector);
  for (const part of selector.split(",").map(p => p.trim())) {
    const stance = /^agent:([a-z][a-z0-9-]*)$/.exec(part)?.[1];
    const pin = /^model:([^\s,:/]+\/[^\s,:]+):([a-z]+)$/.exec(part);
    if (stance) { if (task.agent !== stance) throw new Error("dispatch: " + task.handle + " is assigned to " + part + ", not agent " + task.agent); }
    else if (pin) { if (task.model !== pin[1] || task.effort !== pin[2]) throw new Error("dispatch: " + task.handle + " is pinned to " + part); }
    else throw new Error("dispatch: invalid assignee " + selector);
  }
}

/** A submitted worker. Plain data, so it survives being persisted (supervision state); reattach with wm.attach(run, handle). */
export interface Handle {
  handle: string; run: string; path: string;
  threadId?: string;
  /** Legacy receipt field; never selects a terminal transport. */
  session?: string;
  /** The topic's last report before launch: topics are reused (redispatch, a restarted run), so
   * pass it as children.turnEnd's `after` cursor or an old report reads as this worker's. */
  cursor?: string;
}
/** The worker's board topic, which is also its child ID for children.turnEnd/send. */
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
function ledger(cwd: string, task: Assignment, run: string, handle: Handle, parent?: string) {
  try {
    const common = execFileSync("git", ["-C", cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim();
    const issue = task.issue ?? task.prompt.match(/issues\/(?!archive\/)([a-z0-9][a-z0-9-]*)(?:\.md|\]\]|\|)/)?.[1];
    const dir = join(common, "ab-dispatch");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, (run + "-" + task.handle).replace(/[^A-Za-z0-9_-]/g, "-") + ".json"), JSON.stringify({
      run, handle: task.handle, threadId: handle.threadId, issue: issue ?? null, path: handle.path, parent: parent ?? null,
      agent: handle.handle, at: new Date().toISOString() }, null, 1));
  } catch {}
}

/** Submit a ready wave; no automatic wait or retry for assignments beyond capacity. */
export async function dispatch(assignments: Assignment[], options: Options): Promise<Receipt> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const parent = options.parent ?? process.env.PI_SESSION_ID;
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
      const wm = await import("./wm.ts");
      const cursor = (await (await import("./children.ts")).last(options.run + "/" + task.handle))?.cursor;
      const worker = await wm.spawn({ run: options.run, handle: task.handle, prompt: task.prompt,
        agent: task.agent, role: task.role, base: task.base, model: task.model, effort: task.effort, cwd, parentSession: parent, session: options.session, follow: options.follow });
      receipt.submitted.push({ handle: task.handle, run: options.run, path: worker.dir, threadId: worker.threadId, ...(cursor && { cursor }) });
      ledger(cwd, task, options.run, receipt.submitted.at(-1)!, parent);
    } catch (error) {
      receipt.failed = { assignment: task, error: error instanceof Error ? error.message : String(error) };
      receipt.pending = prepared.slice(index + 1).map(item => item.task);
      break;
    }
  }
  return receipt;
}

export { appendUnion } from "./thread/append-union";

/** Merge a settled worker's branch into the parent checkout, then retire its host resources.
 * Uncommitted work refuses; conflicts abort, except appends to tracker issues (see appendUnion). Optional prepare runs on the child after
 * rebase (or before a merge-mode merge), before touching the parent; it must leave clean commits.
 * keep leaves cleanup to the caller, e.g. after persisting supervision state. */
export class MergeConflict extends Error {
  constructor(readonly branch: string, readonly files: string[]) { super("conflicts merging " + branch + ": " + files.join(", ")); this.name = "MergeConflict"; }
}
export interface Integration { branch: string; mode: "rebase" | "merge"; removed?: unknown; killed?: number[]; branchDeleted?: string; branchKept?: string }
/** Receipts resolve by registry identity/path, never by a guessed checkout layout. */
async function recordOf(given: Handle | string, cwd: string): Promise<{ worker: Handle; thread: ThreadRecord }> {
  let thread: ThreadRecord | undefined;
  if (typeof given === "string") thread = await workerThread(given, cwd);
  else if (given.threadId) thread = await getThread(given.threadId);
  else {
    const matches = (await allThreads(true)).filter(t => t.worker?.handle === given.handle && t.worker.run === given.run && t.cwd === resolve(given.path));
    if (matches.length > 1) throw new Error("Ambiguous worker receipt: " + topic(given));
    thread = matches[0];
  }
  if (!thread?.worker) throw new Error("No registered worker " + (typeof given === "string" ? given : topic(given)));
  if (typeof given !== "string" && (thread.worker.handle !== given.handle || thread.worker.run !== given.run || thread.cwd !== resolve(given.path)))
    throw new Error("Receipt does not match thread " + thread.id);
  return { thread, worker: { ...(typeof given === "string" ? {} : given), ...thread.worker, path: thread.cwd, threadId: thread.id } };
}

export async function integrate(given: Handle | string,
    options: { cwd?: string; mode?: "rebase" | "merge"; keep?: boolean; prepare?: (worker: Handle) => Promise<void> } = {}): Promise<Integration> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const { worker, thread } = await recordOf(given, cwd);
  const mode = options.mode ?? "rebase";
  let branch: string;
  try {
    const integrated = await integrateThread(thread.id, { mode, prepare: options.prepare ? async () => options.prepare!(worker) : undefined });
    branch = integrated?.branch ?? thread.branch ?? worker.handle;
  } catch (error) { if (error instanceof ThreadMergeConflict) throw new MergeConflict(error.branch, error.files); throw error; }
  const result: Integration = { branch, mode };
  if (options.keep) return result;
  return Object.assign(result, await retire(worker, { cwd }));
}

/** Retire through lifecycle, then delete only patches already in the recorded ab-parent. */
export async function retire(given: Handle | string, options: { cwd?: string } = {}): Promise<Omit<Integration, "branch" | "mode">> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const { worker, thread } = await recordOf(given, cwd);
  const git = (...args: string[]) => new Promise<{ code: number; out: string; err: string }>(done =>
    execFile("git", ["-C", thread.project, ...args], (error, out, err) => done({ code: typeof (error as any)?.code === "number" ? (error as any).code : error ? 1 : 0, out: out.trim(), err: err.trim() })));
  const result: Awaited<ReturnType<typeof retire>> = {};
  const wm = await import("./wm.ts");
  const host = wm.attach(worker.run, worker.handle, cwd, worker.session, thread.id);
  try { result.removed = await host.close(true); } finally { host.drop(); }
  result.killed = (result.removed as { killed?: number[] } | undefined)?.killed ?? [];
  if (thread.ownership === "owner" && thread.branch) {
    const branch = thread.branch;
    const parent = await git("config", "--get", "branch." + branch + ".ab-parent");
    const cherry = parent.code || !parent.out ? { code: 1, out: "", err: "missing ab-parent" } : await git("cherry", parent.out, branch);
    const merged = !cherry.code && !cherry.out.split("\n").some(line => line.startsWith("+"));
    const deleted = merged ? await git("branch", "-D", branch) : { code: 1, out: "", err: cherry.err || "not merged into " + parent.out };
    if (deleted.code) result.branchKept = branch + ": " + (deleted.err || deleted.out); else result.branchDeleted = branch;
  }
  return result;
}
