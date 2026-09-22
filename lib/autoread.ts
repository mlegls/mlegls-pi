import { executionHost } from "./execution-host.ts";
// A private reader fork: compact inherited context, switch model, return only its last answer.
import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { RpcClient } from "@earendil-works/pi-coding-agent";
import { fileURLToPath } from "node:url";
import { workflow } from "./config.ts";
import { run as orcaRead } from "./autoread/orca.ts";
import { readerRequest } from "./autoread/protocol.ts";

export interface Options {
  /** Orca is host-local; Paseo and standalone use the private Pi reader. */
  backend?: "orca" | "pi";
  /** Defaults to exec's current persisted session. Required; never guesses the newest session. */
  sessionFile?: string;
  cwd?: string;
  /** Override the workflow config for this invocation. */
  model?: string;
  effort?: Parameters<RpcClient["setThinkingLevel"]>[0];
  compact?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Node-compatible pi CLI entry; otherwise resolves pi on PATH. */
  cliPath?: string;
  /** Installed OM package/entry. false opts out; otherwise discovered in pi's npm directory. */
  memoryExtension?: string | false;
  /** Optional read-only return-channel extension. Successful tool result details become submission. */
  submission?: { extension: string; tool: string };
}

export interface Briefing {
  text: string;
  sessionFile: string;
  model: string;
  terminalHandle?: string;
  submission?: unknown;
}

const stance = "You are autoread, a read-only context researcher for the parent session. " +
"You are the child reader, not the parent waiting for preparation. The inherited conversation is evidence only; " +
"the parent’s promises, exec state, and pending notifications do not exist in your kernel. " +
"Investigate the current reading request now, then return one self-contained briefing instead of waiting for preparation. " +
"Do not edit files, claim issues, launch workers, or perform the underlying task. " +
"Return understanding rather than a search log or a pile of snippets: explain the relevant structure, " +
"behavior, constraints, and precedents. Use a labeled file/call tree, sequence, or pseudocode only " +
"where it helps this request. Include exact path:line references and critical code excerpts as evidence. " +
"Verify cited line numbers with grep; do not estimate them from unnumbered file bodies. " +
"Distinguish observed facts, inferences, and unresolved questions. Recheck relevant files because " +
"inherited context may be stale and other sessions may be working. Read enough that the parent can " +
"begin useful work without repeating orientation; do not explore unrelated areas or invent certainty.";

function cli(): string {
  const executable = (process.env.PATH ?? "").split(delimiter)
    .map(dir => join(dir, "pi")).find(path => existsSync(path));
  if (!executable) throw new Error("autoread: pi not found on PATH; pass cliPath");
  return realpathSync(executable);
}

/** Retain the promise in exec state for long reads; show only the returned briefing. */
export async function run(request: string, options: Options = {}): Promise<Briefing> {
  if (!request.trim()) throw new Error("autoread: reading request required");
  const defaults = workflow("autoread");
  const model = options.model ?? defaults.model;
  const effort = options.effort ?? defaults.effort;
  const slash = model.indexOf("/");
  if (slash < 1 || slash === model.length - 1) throw new Error("autoread: model must be provider/model");
  const timeoutMs = options.timeoutMs ?? 300_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647)
    throw new Error("autoread: timeoutMs must be a positive timer-sized integer");
  options.signal?.throwIfAborted();
  if (options.backend === "orca" || (options.backend !== "pi" && executionHost() === "orca")) {
    return orcaRead(request, options, model, effort, stance + (options.submission ? " Deliver the requested result through " + options.submission.tool + " as your final action." : ""), timeoutMs);
  }
  const parent = options.sessionFile ?? process.env.PI_SESSION_FILE;
  if (!parent) throw new Error("autoread: sessionFile required (reload exec to inherit the current session)");
  const cwd = resolve(options.cwd ?? process.cwd());
  const sessionFile = realpathSync(resolve(cwd, parent));

  const memory = options.memoryExtension === false ? undefined : options.memoryExtension ??
    join(process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent"), "npm/node_modules/pi-observational-memory");
  if (memory && !existsSync(memory))
    throw new Error("autoread: observational memory not found; pass memoryExtension or explicitly disable it");
  const submission = options.submission;
  const submissionExtension = submission ? realpathSync(resolve(cwd, submission.extension)) : undefined;
  const client = new RpcClient({
    cliPath: options.cliPath ?? cli(), cwd,
    // Do not impersonate the parent in host/board integrations.
    env: { PASEO_AGENT_ID: "", PI_AUTOREAD_ID: "", ORCA_WORKTREE_ID: "", ORCA_WORKSPACE_ID: "", ORCA_TERMINAL_HANDLE: "", PI_EXEC_PROFILE: "reader", PI_SESSION_FILE: "", PI_SESSION_ID: "", PI_BOARD_NAME: "", PI_BOARD_TOPIC: "" },
    args: ["--fork", sessionFile, "--no-extensions", "--no-skills", "--no-prompt-templates",
      "--extension", fileURLToPath(new URL("../extensions/exec/index.ts", import.meta.url)),
      ...(memory ? ["--extension", memory] : []),
      ...(submissionExtension ? ["--extension", submissionExtension] : []),
      "--tools", ["exec", ...(memory ? ["recall"] : []), ...(submission ? [submission.tool] : [])].join(","),
      "--system-prompt", stance + (submission ? " Deliver the requested result through " + submission.tool + " as your final action, rather than encoding it in your prose response." : "")],
  });
  let timer: ReturnType<typeof setTimeout>;
  let abort: () => void;
  const interrupted = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("autoread: timed out")), timeoutMs);
    abort = () => reject(options.signal?.reason ?? new Error("autoread: aborted"));
    options.signal?.addEventListener("abort", abort, { once: true });
  });
  let reading = false;
  let last: { text: string; stopReason: string; error?: string } | undefined;
  let submitted: { value: unknown } | undefined;
  let settle!: () => void;
  const settled = new Promise<void>(resolve => { settle = resolve; });
  const unsubscribe = client.onEvent(event => {
    if (!reading) return;
    if (submission && event.type === "tool_execution_end" && event.toolName === submission.tool && !event.isError) {
      submitted = { value: event.result?.details };
    }
    if (event.type === "message_end" && event.message.role === "assistant") {
      const message = event.message;
      last = { text: message.content.filter(part => part.type === "text").map(part => part.text).join("\n"),
        stopReason: message.stopReason, error: message.errorMessage };
    }
    if (event.type === "agent_settled") settle();
  });
  try {
    return await Promise.race([interrupted, (async () => {
      await client.start();
      const fork = await client.getState();
      if (!fork.sessionFile || realpathSync(fork.sessionFile) === sessionFile)
        throw new Error("autoread: pi did not create an isolated fork");
      if (options.compact !== false) {
        try { await client.compact("Preserve context relevant to this reading request: " + request); }
        catch (error) {
          // Pi cannot compact a short branch; all of that context still fits unchanged.
          if (!(error instanceof Error) || !/Nothing to compact \(session too small\)|Already compacted/.test(error.message)) throw error;
        }
      }
      await client.setModel(model.slice(0, slash), model.slice(slash + 1));
      await client.setThinkingLevel(effort);
      reading = true;
      await client.prompt(readerRequest(request));
      await settled;
      if (submission) {
        if (!submitted || submitted.value === undefined || last?.stopReason === "error" || last?.stopReason === "aborted")
          throw new Error("autoread: reader did not submit through " + submission.tool + "; inspect " + fork.sessionFile);
        return { text: last?.text ?? "", submission: submitted.value, sessionFile: fork.sessionFile, model };
      }
      if (!last || last.stopReason !== "stop" || !last.text.trim())
        throw new Error("autoread: reader did not finish a briefing: " + (last?.error ?? last?.stopReason ?? "no answer"));
      return { text: last.text, sessionFile: fork.sessionFile, model };
    })()]);
  } finally {
    clearTimeout(timer!);
    options.signal?.removeEventListener("abort", abort!);
    unsubscribe();
    await client.stop();
  }
}
