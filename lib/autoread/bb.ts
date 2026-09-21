import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { Options, Briefing } from "../autoread.ts";
import { readerFiles, readerRequest, type ReaderResult } from "./protocol.ts";

function bb<T = unknown>(args: string[], signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    execFile(process.env.BB_CLI || "bb", [...args, "--json"], { signal, maxBuffer: 4 * 1024 * 1024, timeout: signal ? 0 : 60_000 }, (error, stdout, stderr) => {
      if (error) return reject(new Error("autoread: bb " + args.slice(0, 2).join(" ") + ": " + (stderr || stdout || error.message)));
      try { resolve(JSON.parse(stdout)); } catch (error) { reject(error); }
    });
  });
}

export async function run(request: string, options: Options, model: string, effort: string, systemPrompt: string, timeoutMs: number): Promise<Briefing> {
  const parent = process.env.BB_THREAD_ID;
  if (!parent) throw new Error("autoread: BB_THREAD_ID required for BB readers");
  if (options.cliPath || options.memoryExtension !== undefined)
    throw new Error("autoread: BB owns Pi launch and extensions; use backend: 'pi' for cliPath/memoryExtension overrides");
  if (options.sessionFile && !options.sourceThreadId && options.sessionFile !== process.env.PI_SESSION_FILE)
    throw new Error("autoread: supply sourceThreadId when forking a different BB reader");
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error("autoread: timed out")), timeoutMs);
  const signal = controller.signal;
  const whenReady = async (args: string[]) => {
    while (true) {
      try { return await bb(args, signal); }
      catch (error) {
        if (!/workspace is still being prepared|Context can only be compacted while the thread is idle or errored/.test(String(error))) throw error;
        await delay(500, undefined, { signal });
      }
    }
  };
  let id: string | undefined;
  let messageId: string | undefined;
  let failure: unknown;
  try {
    options.signal?.throwIfAborted();
    type Source = { thread: { providerId: string }; environment: { hostId: string } };
    const owner = await bb<Source>(["thread", "show", parent], signal);
    const source = options.sourceThreadId && options.sourceThreadId !== parent
      ? await bb<Source>(["thread", "show", options.sourceThreadId], signal) : owner;
    if (source.thread.providerId !== "pi" || source.environment.hostId !== owner.environment.hostId)
      throw new Error("BB readers require a Pi source thread on the calling thread's host");
    // Do not cancel creation mid-flight: retain the ID so timeout cleanup can stop the child.
    const child = await bb<{ id: string }>(["thread", "fork", options.sourceThreadId ?? parent,
      "--lifecycle-owner-thread", parent, "--visibility", "visible", "--title", "autoread: " + request.split("\n")[0].slice(0, 90),
      ...(options.cwd ? ["--environment", resolve(options.cwd)] : [])]);
    id = child.id;
    if (!id) throw new Error("autoread: BB fork returned no thread ID");
    await bb(["thread", "update", id, "--parent-thread", parent]);
    signal.throwIfAborted();
    const files = readerFiles(id);
    mkdirSync(files.dir, { recursive: true, mode: 0o700 });
    const submission = options.submission && { ...options.submission, extension: realpathSync(resolve(options.cwd ?? process.cwd(), options.submission.extension)) };
    writeFileSync(files.config, JSON.stringify({ systemPrompt, submission }), { mode: 0o600 });
    writeFileSync(files.request, readerRequest(request), { mode: 0o600 });
    if (options.compact !== false) {
      try { await whenReady(["thread", "compact", id]); }
      catch (error) {
        if (!/Nothing to compact \(session too small\)|Already compacted/.test(String(error))) throw error;
      }
    }
    await bb(["thread", "update", id, "--model", model, "--reasoning-level", effort === "off" ? "none" : effort], signal);
    const queued = await bb<{ id: string }>(["thread", "queue", "create", id, "--message-file", files.request], signal);
    messageId = queued.id;
    try { await whenReady(["thread", "queue", "send", id, queued.id]); }
    catch (error) {
      // BB can auto-dispatch the queue between create and send; never create a second message.
      if (!String(error).includes("Queued message not found")) throw error;
    }
    let active = false;
    while (true) {
      signal.throwIfAborted();
      if (existsSync(files.result)) {
        const result: ReaderResult = JSON.parse(readFileSync(files.result, "utf8"));
        if (result.error) throw new Error(result.error);
        if (!result.sessionFile) throw new Error("reader returned no session file");
        return { text: result.text, sessionFile: result.sessionFile, submission: result.submission, model, threadId: id };
      }
      const { thread } = await bb<{ thread: { status: string; queuedMessageCount: number } }>(["thread", "show", id], signal);
      if (thread.status === "active") active = true;
      if (thread.status === "error" || (active && thread.status === "idle" && thread.queuedMessageCount === 0)) {
        // Result is written before BB observes settled; recheck after the status request.
        if (existsSync(files.result)) continue;
        throw new Error("reader " + thread.status + " without a result; verify lib/autoread/host.ts is loaded");
      }
      await delay(500, undefined, { signal });
    }
  } catch (error) {
    failure = new Error("autoread" + (id ? " (@thread:" + id + ")" : "") + ": " + String(signal.aborted ? signal.reason : error), { cause: error });
    throw failure;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
    // Release the runtime, but retain visible history/config for inspection and follow-up forks.
    if (id) {
      const errors: unknown[] = [];
      if (messageId) {
        try { await bb(["thread", "queue", "delete", id, messageId]); }
        catch (error) { if (!String(error).includes("Queued message not found")) errors.push(error); }
      }
      try { await bb(["thread", "stop", id]); } catch (error) { errors.push(error); }
      if (errors.length) throw new AggregateError(failure ? [failure, ...errors] : errors, "autoread: cleanup failed (@thread:" + id + ")");
    }
  }
}
