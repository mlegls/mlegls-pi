// Orca owns execution and coordination; Pi owns conversation sessions.
import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

export const inOrca = (env: NodeJS.ProcessEnv = process.env): boolean => Boolean(env.ORCA_WORKTREE_ID || env.ORCA_WORKSPACE_ID);
export const quote = (text: string): string => "'" + text.replaceAll("'", "'\\''") + "'";
export function workspace(cwd = process.cwd()): string {
  return "path:" + resolve(cwd);
}
export class OrcaError extends Error {
  constructor(message: string, readonly receipt: unknown) { super(message); this.name = "OrcaError"; }
}

export async function call<T = Record<string, unknown>>(args: string[], cwd = process.cwd(), timeoutMs = 60_000): Promise<T> {
  return new Promise((resolve, reject) => {
    execFile(process.env.ORCA_CLI || process.env.ORCA_CLI_COMMAND || (process.env.ORCA_DEV_REPO_ROOT ? "orca-dev" : process.platform === "linux" && !inOrca() ? "orca-ide" : "orca"), [...args, "--json"], { cwd, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {

      try {
        const response = JSON.parse(stdout);
        if (error || response.ok === false || response.error) throw new OrcaError("orca " + args.slice(0, 2).join(" ") + ": " + (response.error?.message || error?.message || "operation refused"), response);
        if (!("result" in response)) throw new OrcaError("Invalid Orca receipt", response);
        resolve(response.result as T);
      } catch (failure) { reject(failure instanceof OrcaError ? failure : new OrcaError("orca " + args.slice(0, 2).join(" ") + ": " + (stderr || stdout || error?.message || String(failure)), { stdout, stderr, error: error?.message })); }
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


export interface Context { cwd?: string; from?: string; run?: string; retryRequest?: string }
export interface Receipt { [key: string]: unknown }
export type StartConfirmation = { status: "started" | "unconfirmed"; evidencePath?: string; reason?: string };
export interface WorkerReceipt extends Receipt {
  startConfirmation: StartConfirmation;
  runId: string; taskId: string; dispatchId: string;
  state: string; stage: string;
  effects: Array<{ kind: string; action?: string; id?: string; [key: string]: unknown }>;
}
export interface Message extends Receipt { id: string; type: string; body: string; subject: string; payload: string | null }
export interface Delivery extends Receipt { runId?: string; deliveryId?: string | null; messages: Message[]; count: number; replayed?: boolean; timedOut?: boolean }
type Flags = object;
const argv = (options: Flags) => Object.entries(options).flatMap(([key, value]) => {
  if (value === undefined || value === false || key === "cwd") return [];
  const flag = "--" + key.replace(/[A-Z]/g, c => "-" + c.toLowerCase());
  return value === true ? [flag] : [flag, typeof value === "object" ? JSON.stringify(value) : String(value)];
});
/** Receipts are returned intact; no retry, acknowledgement, or lifecycle inference. */
const operation = <T = Receipt>(verb: string, options: Flags = {}) => {
  const { cwd, timeoutMs } = options as { cwd?: string; timeoutMs?: number };
  return call<T>(["orchestration", verb, ...argv(options)], cwd, timeoutMs === undefined ? 60_000 : timeoutMs + 30_000);
};

export const runs = {
  create: (options: Omit<Context, "run"> & { objective: string }) => operation<{ run: { id: string; [key: string]: unknown } }>("run-create", options),
  use: (options: Omit<Context, "run"> & { id: string }) => operation("run-use", options),
  current: (options: Omit<Context, "run"> = {}) => operation("run-current", options),
  list: () => operation("run-list"),
  show: (id: string) => operation("run-show", { id }),
};
export interface Start extends Context {
  spec?: string; task?: string; taskTitle?: string; deps?: string[]; parent?: string;
  agent?: string; terminal?: string; model?: string; effort?: string;
  worktree?: string; on?: string; name?: string; repo?: string; baseBranch?: string;
  setup?: "run" | "skip" | "inherit"; retryOf?: string; timeoutMs?: number;
}
export const workers = {
  startPi,
  submit,
  confirmStart,
  start: async (options: Start): Promise<WorkerReceipt> => {
    if (Boolean(options.spec?.trim()) === Boolean(options.task?.trim()))
      throw new Error("workers.start: exactly one nonempty spec/task required");
    const receipt = await operation<WorkerReceipt>("worker-start", { ...options, timeoutMs: options.timeoutMs ?? 60_000 });
    return { ...receipt, startConfirmation: { status: "unconfirmed", reason: "Input accepted; no worker-side turn-start evidence observed" } };
  },
  show: (dispatch: string) => operation("worker-show", { dispatch }),
  read: (options: { dispatch: string; source?: "auto" | "terminal" | "transcript"; cursor?: string; limit?: number }) => operation("worker-read", options),
  list: (options: { run?: string; includeRemote?: boolean; terminalState?: string; cursor?: string; limit?: number } = {}) => operation("worker-list", options),
  release: (dispatch: string) => operation("worker-release", { dispatch }),
  retain: (dispatch: string) => operation("worker-retain", { dispatch }),
  stop: (options: { dispatch: string; retryRequest?: string }) => operation("worker-stop", options),
  abandon: (options: { dispatch: string; reason: string; retryRequest?: string }) => operation("worker-abandon", options),
};
export const tasks = {
  create: (options: Context & { taskTitle?: string; spec: string; deps?: string[]; parent?: string }) => operation("task-create", options),
  list: (options: { run?: string; from?: string; status?: string; ready?: boolean; brief?: boolean } = {}) => operation("task-list", options),
};
export interface Check { terminal?: string; run?: string; ack?: string; wait?: boolean; timeoutMs?: number; types?: string[]; peek?: boolean; all?: boolean; retryRequest?: string }
export const check = (options: Check = {}) => operation<Delivery>("check", { ...options, types: options.types?.join(","), ...(options.wait ? { timeoutMs: options.timeoutMs ?? 900_000 } : {}) });
/** Ack may return the next delivery. Handle it; do not discard the receipt. */
export const ack = (deliveryId: string, options: Omit<Check, "ack"> = {}) => check({ ...options, ack: deliveryId });
export interface Send extends Context {
  to?: string; subject: string; body?: string; type?: "status" | "dispatch" | "worker_done" | "merge_ready" | "escalation" | "handoff" | "decision_gate" | "question" | "heartbeat";
  priority?: string; threadId?: string; payload?: unknown; taskId?: string; dispatchId?: string;
  dispatchCapability?: string; outcome?: "succeeded" | "failed"; filesModified?: string; reportPath?: string; phase?: string;
}
export const send = (options: Send) => operation("send", options);
export const reply = (options: Context & { id: string; body: string }) => operation("reply", options);
export const ask = (options: Context & { question?: string; resume?: string; to?: string; dispatchCapability?: string; options?: string[]; timeoutMs?: number }) =>
  operation("ask", { ...options, options: options.options?.join(","), timeoutMs: options.timeoutMs ?? 900_000 });

/** Pi model selection is not supported by native worker-start in Orca 1.4.206.
 * Launch in an existing workspace, then enroll via the supported --terminal path.
 * This pre-existing terminal remains caller-owned: release will not close it.
 */
export async function startPi(options: Context & {
  spec?: string; task?: string; taskTitle?: string; worktree?: string;
  model: string; effort: string; timeoutMs?: number; startWaitMs?: number;
}): Promise<WorkerReceipt & { clientTerminal: Terminal }> {
  if ((Boolean(options.spec?.trim()) === Boolean(options.task?.trim())) || !options.model.trim() || !options.effort.trim())
    throw new Error("startPi: exactly one of spec/task, model and effort required");
  const target = options.worktree ?? workspace(options.cwd);
  if (["current", "active", "new-child", "new-top-level"].includes(target))
    throw new Error("startPi: use an exact existing workspace selector; create the workspace first");
  const { model, effort, startWaitMs = 5_000, ...start } = options;
  if (!Number.isFinite(startWaitMs) || startWaitMs < 0) throw new Error("startWaitMs must be nonnegative and finite");
  const token = randomUUID();
  const evidencePath = resolve(await mkdtemp(resolve(tmpdir(), "pi-orca-start-")), "started.json");
  if (start.spec) start.spec += "\n\n[Pi launch correlation: " + token + "]";
  const tab = await terminal("PI_ORCA_START_EVIDENCE=" + quote(evidencePath) + " PI_ORCA_START_TOKEN=" + quote(token) + " " + piCommand(["--model", model, "--thinking", effort === "none" ? "off" : effort]),
    options.taskTitle ?? "Pi worker", options.cwd, target);
  try {
    const receipt = { ...await workers.start({ ...start, worktree: target, terminal: tab.handle }), clientTerminal: tab };
    receipt.startConfirmation.evidencePath = evidencePath;
    receipt.startConfirmation = await confirmStart(receipt, startWaitMs);
    return receipt;
  } catch (error) {
    throw new OrcaError("Pi terminal retained; inspect before retrying: " + tab.handle + ". " + String(error),
      { clientTerminal: tab, startConfirmation: { status: "unconfirmed", evidencePath }, cause: error instanceof OrcaError ? error.receipt : String(error) });
  }
}

/** Create a Pi terminal and submit its assignment in one invocation. No automatic retry. */
export function submit(options: Context & { spec: string; model: string; effort: string; worktree?: string; taskTitle?: string; timeoutMs?: number; startWaitMs?: number }) {
  return startPi(options);
}

/** Re-observe a launch without resubmitting work or consuming coordinator mail. */
export async function confirmStart(receipt: WorkerReceipt, waitMs = 0): Promise<StartConfirmation> {
  if (!Number.isFinite(waitMs) || waitMs < 0) throw new Error("waitMs must be nonnegative and finite");
  const { evidencePath } = receipt.startConfirmation;
  if (!evidencePath || receipt.startConfirmation.status === "started") return receipt.startConfirmation;
  const deadline = Date.now() + waitMs;
  do {
    try {
      const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
      if (evidence.event === "before_agent_start") return { status: "started", evidencePath };
    } catch { /* Missing or incomplete evidence is not proof of failure. */ }
    if (Date.now() >= deadline) break;
    await new Promise(resolve => setTimeout(resolve, Math.min(100, deadline - Date.now())));
  } while (true);
  return { status: "unconfirmed", evidencePath, reason: "No correlated Pi turn-start event observed; inspect this dispatch, do not resubmit" };
}
