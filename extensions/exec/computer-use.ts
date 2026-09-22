import { STATE_ENTRY, journal, restorationRecords } from "./desktop-restore";
import { captureSummary } from "./desktop-discovery";
import { type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";

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

async function loadComputerUseRuntime() {
 const sdk = await import("@trycua/cua-driver");
 const { createCuaRuntime } = await import("./cua-runtime");
 return {
  factory: () => createCuaRuntime(sdk),
  registerSetup(pi: ExtensionAPI, runtime: ComputerUseRuntime) {
   pi.registerCommand("computer-use", {
    description: "Cua status; /computer-use setup requests native permissions",
    async handler(args, ctx) {
     const status = args.trim() === "setup" ? await runtime.setup() : process.platform === "darwin" ? sdk.currentMacOsPermissionStatus() : { platform: process.platform };
     ctx.ui.notify("Cua 0.28.2: " + JSON.stringify(status) + ". Background delivery is the default; reload requires fresh observations.", "info");
    },
   });
  },
 };
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
    return { ...result, capture: captureSummary(result.details) };
   } finally {
    pending.delete(operation);
    // Rejected native writes can still advance resource epochs. Never journal
    // a cancelled caller or an operation from a departed session/branch.
    checkCurrent();
    pi.appendEntry(STATE_ENTRY, journal(runtime.exportSnapshot({ incremental: true })));
   }
  },
 };
}
function message(error: unknown) { return error instanceof Error ? error.message : String(error); }
