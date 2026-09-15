import { STATE_ENTRY, journal, restorationRecords } from "./desktop-restore";
import { captureSummary } from "./desktop-discovery";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { getAgentDir, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";

export const computerUseTools = {
 findRoots: "find_roots", observe: "observe_ui", search: "search_ui", expand: "expand_ui",
 inspect: "inspect_ui", act: "act_ui", readText: "read_text", waitFor: "wait_for",
} as const;
type Method = keyof typeof computerUseTools;
type Result = { content: unknown[]; details?: unknown; isError?: boolean };
/** Structural public seam: optional package types need not be installed to use exec. */
export type ComputerUseRuntime = Record<Method, (params: any, signal?: AbortSignal) => Promise<Result>> & {
 help(method?: string): { method: string; [key: string]: unknown }[];
 exportSnapshot(options?: { incremental?: boolean }): unknown;
 restoreSnapshot(snapshot: any): Promise<void>;
 reset(): Promise<void>;
 close(): Promise<void>;
 setup(ui?: any, signal?: AbortSignal): Promise<unknown>;
};
export type ComputerUseRuntimeFactory = (options: { cwd?: string | (() => string) }) => ComputerUseRuntime | Promise<ComputerUseRuntime>;
export interface ComputerUseBridge {
 call(method: string, args: unknown, ctx: ExtensionContext, signal: AbortSignal): Promise<unknown>;
}

let loaderReady = false;
async function loadComputerUseRuntime() {
 const entry = "@injaneity/pi-computer-use/runtime";
 let runtimePath: string | undefined;
 let setupPath: string | undefined;
 for (const base of [import.meta.url, join(getAgentDir(), "npm", "package.json")]) {
  const require = createRequire(base);
  try {
   runtimePath = require.resolve(entry);
   setupPath = require.resolve("@injaneity/pi-computer-use/setup");
   break;
  } catch (error) {
   const code = (error as NodeJS.ErrnoException).code;
   if (code === "ERR_PACKAGE_PATH_NOT_EXPORTED") throw new Error("ui requires the pi-computer-use headless-runtime fork; the installed package lacks public runtime/setup exports.");
   if (code !== "MODULE_NOT_FOUND") throw error;
  }
 }
 if (!runtimePath || !setupPath) throw new Error("ui requires the optional pi-computer-use headless-runtime fork dependency. Install this project's optional dependencies and disable the independent pi-computer-use extension entry.");
 // Use the ordinary module graph, including upstream non-erasable TypeScript.
 if (!loaderReady && !process.versions.bun) { (await import("tsx/esm/api")).register(); loaderReady = true; }
 const runtime = await import(pathToFileURL(runtimePath).href);
 const setup = await import(pathToFileURL(setupPath).href);
 if (typeof runtime.createComputerUseRuntime !== "function" || typeof setup.registerComputerUseSetup !== "function") throw new Error("ui requires the pi-computer-use headless-runtime fork's public runtime/setup exports.");
 return { factory: runtime.createComputerUseRuntime as ComputerUseRuntimeFactory, registerSetup: setup.registerComputerUseSetup };
}

export async function createComputerUseBridge(pi: ExtensionAPI, factory?: ComputerUseRuntimeFactory): Promise<ComputerUseBridge> {
 let cwd = process.cwd();
 let runtime: ComputerUseRuntime;
 let registerSetup: ((pi: ExtensionAPI, runtime: ComputerUseRuntime) => void) | undefined;
 try {
  if (!factory) { const loaded = await loadComputerUseRuntime(); factory = loaded.factory; registerSetup = loaded.registerSetup; }
  runtime = await factory({ cwd: () => cwd });
 } catch (error) {
  return { async call() { throw new Error("ui unavailable: " + message(error), { cause: error }); } };
 }
 let generation = 0;
 let acceptingCalls = false;
 let sessionId: string | undefined;
 let restorationError: string | undefined;
 let lifecycleAbort = new AbortController();
 let lifecycleWork = Promise.resolve();
 const pending = new Set<Promise<unknown>>();
 async function lifecycle(ctx: ExtensionContext, shutdown = false) {
  const current = ++generation;
  acceptingCalls = false;
  lifecycleAbort.abort(new Error("Computer-use session or branch changed"));
  lifecycleAbort = new AbortController();
  lifecycleWork = lifecycleWork.catch(() => {}).then(async () => {
   await Promise.allSettled([...pending]);
   if (shutdown) { await runtime.close(); return; }
   if (current !== generation) return;
   cwd = ctx.cwd;
   restorationError = undefined;
   try {
    await runtime.reset();
    const { snapshots, legacy } = restorationRecords(ctx);
    if (legacy) ctx.ui.notify("Older UI observations cannot be restored after this upgrade; re-observe to get fresh refs.", "warning");
    for (const snapshot of snapshots) {
     if (current !== generation) return;
     await runtime.restoreSnapshot(snapshot);
    }
   } catch (error) {
    restorationError = "ui restoration failed; re-observe on a fresh branch: " + message(error);
    try { await runtime.reset(); } catch { /* Keep failure scoped to ui. */ }
    ctx.ui.notify(restorationError, "warning");
   }
   if (current !== generation) return;
   sessionId = ctx.sessionManager.getSessionId();
   acceptingCalls = !restorationError;
  });
  return lifecycleWork;
 }
 pi.on("session_start", (_event, ctx) => lifecycle(ctx));
 pi.on("session_tree", (_event, ctx) => lifecycle(ctx));
 pi.on("session_shutdown", (_event, ctx) => lifecycle(ctx, true));
 // The public Pi adapter registers only configuration/onboarding, on this same owner.
 registerSetup?.(pi, runtime);
 return {
  async call(method, args, ctx, signal) {
   signal.throwIfAborted();
   if (method === "help") {
    const requested = (args as { method?: string } | undefined)?.method;
    if (requested !== undefined && !Object.hasOwn(computerUseTools, requested)) throw new Error("Unknown ui method: " + requested);
    return runtime.help(requested).filter(tool => Object.hasOwn(computerUseTools, tool.method));
   }
   if (!Object.hasOwn(computerUseTools, method)) throw new Error("Unknown ui method: " + method);
   const current = generation;
   const callerSessionId = ctx.sessionManager.getSessionId();
   signal = AbortSignal.any([signal, lifecycleAbort.signal]);
   function checkCurrent() {
    signal.throwIfAborted();
    if (restorationError) throw new Error(restorationError);
    if (!acceptingCalls || current !== generation || callerSessionId !== ctx.sessionManager.getSessionId() || callerSessionId !== sessionId) throw new Error("Computer-use session or branch changed");
   }
   checkCurrent();
   const operation = runtime[method as Method](args ?? {}, signal);
   pending.add(operation);
   try {
    const result = await operation;
    checkCurrent();
    pi.appendEntry(STATE_ENTRY, journal(runtime.exportSnapshot({ incremental: true })));
    return { ...result, capture: captureSummary(result.details) };
   } finally { pending.delete(operation); }
  },
 };
}
function message(error: unknown) { return error instanceof Error ? error.message : String(error); }
