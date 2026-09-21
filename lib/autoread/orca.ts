import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { terminal, stop, piCommand, quote } from "../orca.ts";
import type { Options, Briefing } from "../autoread.ts";
import { readerFiles, type ReaderResult } from "./protocol.ts";

export async function run(request: string, options: Options, model: string, effort: string, systemPrompt: string, timeoutMs: number): Promise<Briefing> {
  const parent = options.sessionFile ?? process.env.PI_SESSION_FILE;
  if (!parent) throw new Error("autoread: sessionFile required");
  const cwd = resolve(options.cwd ?? process.cwd());
  const source = realpathSync(resolve(cwd, parent));
  const memory = options.memoryExtension === false ? undefined : options.memoryExtension ??
    join(process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent"), "npm/node_modules/pi-observational-memory");
  if (memory && !existsSync(memory)) throw new Error("autoread: observational memory not found; pass memoryExtension or false");
  const id = randomUUID();
  const files = readerFiles(id);
  mkdirSync(files.dir, { recursive: true, mode: 0o700 });
  const submission = options.submission && { ...options.submission, extension: realpathSync(resolve(cwd, options.submission.extension)) };
  writeFileSync(files.config, JSON.stringify({ request, model, effort, systemPrompt, compact: options.compact, submission }), { mode: 0o600 });
  const args = ["--fork", source, "--no-extensions", "--no-skills", "--no-prompt-templates",
    "-e", fileURLToPath(new URL("../../extensions/exec/index.ts", import.meta.url)),
    ...(memory ? ["-e", memory] : []), "-e", fileURLToPath(new URL("./host.ts", import.meta.url)),
    "--exec-profile", "reader"];
  const command = options.cliPath ? ["node", quote(options.cliPath), ...args.map(quote)].join(" ") : piCommand(args);
  const signal = AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(options.signal ? [options.signal] : [])]);
  let handle: string | undefined;
  let failure: unknown;
  try {
    signal.throwIfAborted();
    // Do not abort a create request: obtain its handle before timeout cleanup.
    const tab = await terminal("env PI_AUTOREAD_ID=" + quote(id) + " PI_EXEC_PROFILE=reader " + command, "autoread: " + request.split("\n")[0].slice(0, 90), cwd);
    handle = tab.handle;
    while (true) {
      signal.throwIfAborted();
      if (existsSync(files.result)) {
        const result: ReaderResult = JSON.parse(readFileSync(files.result, "utf8"));
        if (result.error) throw new Error(result.error);
        if (!result.sessionFile || realpathSync(result.sessionFile) === source) throw new Error("Reader did not create an isolated fork");
        return { text: result.text, sessionFile: result.sessionFile, submission: result.submission, model, terminalHandle: handle };
      }
      await delay(500, undefined, { signal });
    }
  } catch (error) {
    failure = new Error("autoread (" + (handle ?? files.dir) + "): " + String(error), { cause: error });
    throw failure;
  } finally {
    if (handle) {
      try { await stop(handle); }
      catch (error) { throw new AggregateError(failure ? [failure, error] : [error], "Reader cleanup failed: " + handle); }
    }
  }
}
