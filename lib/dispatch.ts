// Launch a parent-planned ready wave. No reading, routing, dependency graph, or retries.
import { inOrca, call, terminal, workspace, piCommand, quote } from "./orca.ts";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { agent } from "./agents.ts";
import type { Worker } from "./wm.ts";

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
  run: string;
  cwd?: string;
  /** Parent-scoped budget, including active handles, on either backend. */
  maxConcurrent: number;
  /** All still-outstanding workers supervised by this parent, across waves. */
  active: Handle[];
}

export type Handle =
  | { backend: "orca"; handle: string; terminal: string; worktreeId: string; path: string }
  | { backend: "wm"; handle: string; worker: Worker };

export interface Receipt {
  launched: Handle[];
  /** Backend failure can leave resources behind. Inspect before retrying this assignment. */
  failed?: { assignment: Assignment; error: string };
  /** Never attempted (capacity or earlier failure); parent decides when to submit later. */
  pending: Assignment[];
}

/** Submit a ready wave; no automatic wait or retry for assignments beyond capacity. */
export async function dispatch(assignments: Assignment[], options: Options): Promise<Receipt> {
  const useOrca = inOrca();
  const cwd = resolve(options.cwd ?? process.cwd());
  if (!/^[A-Za-z0-9][A-Za-z0-9_/-]*$/.test(options.run)) throw new Error("dispatch: invalid run");
  if (!Number.isSafeInteger(options.maxConcurrent) || options.maxConcurrent < 1)
    throw new Error("dispatch: positive maxConcurrent required");
  if (!Array.isArray(options.active) || options.active.some(handle => handle.backend !== (useOrca ? "orca" : "wm")))
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
      if (useOrca) {
        const text = [stance?.body, task.prompt,
          "You are " + task.handle + " in run " + options.run + ". " +
          "Use board.send on " + options.run + "/" + task.handle + " with done / blocked / needs-input tags to report. " +
          "Coordinate with peers on " + options.run + "/*; commit changes for the parent to merge."
        ].filter(Boolean).join("\n\n---\n\n");
        const dir = join(process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent"), "orca", randomUUID());
        mkdirSync(dir, { recursive: true, mode: 0o700 });
        const prompt = join(dir, "prompt.md");
        writeFileSync(prompt, text, { mode: 0o600 });
        const created = await call<{ worktree: { id: string; path: string } }>([
          "worktree", "create", "--name", options.run.replaceAll("/", "-") + "-" + task.handle,
          "--parent-worktree", workspace(cwd), "--setup", "run",
          ...(task.base ? ["--base-branch", task.base] : [])], cwd);
        const worktree = created.worktree;
        if (!worktree?.id || !worktree.path) throw new Error("dispatch: invalid worktree receipt " + JSON.stringify(created));
        try {
          const launched = await terminal("env PI_BOARD_NAME=" + quote(task.handle) + " PI_BOARD_TOPIC=" + quote(options.run + "/" + task.handle) + " " + piCommand(["--model", task.model, "--thinking", task.effort === "none" ? "off" : task.effort,
            "@" + prompt]), options.run + "/" + task.handle, cwd, "id:" + worktree.id);
          receipt.launched.push({ backend: "orca", handle: task.handle, terminal: launched.handle, worktreeId: worktree.id, path: worktree.path });
        } catch (error) {
          throw new Error("Worktree retained at " + worktree.path + " (" + worktree.id + "): " + String(error));
        }
      } else {
        const wm = await import("./wm.ts");
        const worker = await wm.spawn({ run: options.run, handle: task.handle, prompt: task.prompt,
          agent: task.agent, base: task.base, cwd,
          model: task.model, effort: task.effort });
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
