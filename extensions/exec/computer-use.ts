import { type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";

export const computerUseTools = Object.fromEntries([
 "list_apps", "list_windows", "get_window_state", "verify_state", "click", "type_text", "press_key", "set_value", "scroll", "drag",
].map(name => [name, name]));
export type ComputerUseRuntime = {
 call(method: string, params: any, signal?: AbortSignal): Promise<any>;
 help(method?: string, signal?: AbortSignal): Promise<any[]>;
 reset(): Promise<void>;
 close(): Promise<void>;
 setup(): Promise<unknown>;
};
export type ComputerUseRuntimeFactory = () => ComputerUseRuntime | Promise<ComputerUseRuntime>;
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
 let runtime: ComputerUseRuntime;
 let registerSetup: ((pi: ExtensionAPI, runtime: ComputerUseRuntime) => void) | undefined;
 try {
  if (!factory) { const loaded = await loadComputerUseRuntime(); factory = loaded.factory; registerSetup = loaded.registerSetup; }
  runtime = await factory();
 } catch (error) {
  return { async call() { throw new Error("ui unavailable: " + message(error), { cause: error }); } };
 }
 let generation = 0;
 let acceptingCalls = false;
 let sessionId: string | undefined;
 let resetError: string | undefined;
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
   resetError = undefined;
   try {
    await runtime.reset();
   } catch (error) {
    resetError = "ui reset failed; restart and re-observe: " + message(error);
    try { await runtime.reset(); } catch { /* Keep failure scoped to ui. */ }
    ctx.ui.notify(resetError, "warning");
   }
   if (current !== generation) return;
   sessionId = ctx.sessionManager.getSessionId();
   acceptingCalls = !resetError;
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
   const requested = method === "help" ? (args as { method?: string } | undefined)?.method : undefined;
   if (method === "help") {
    if (requested !== undefined && !Object.hasOwn(computerUseTools, requested)) throw new Error("Unknown ui method: " + requested);
   } else if (!Object.hasOwn(computerUseTools, method)) throw new Error("Unknown ui method: " + method);
   const current = generation;
   const callerSessionId = ctx.sessionManager.getSessionId();
   signal = AbortSignal.any([signal, lifecycleAbort.signal]);
   function checkCurrent() {
    signal.throwIfAborted();
    if (resetError) throw new Error(resetError);
    if (!acceptingCalls || current !== generation || callerSessionId !== ctx.sessionManager.getSessionId() || callerSessionId !== sessionId) throw new Error("Computer-use session or branch changed");
   }
   checkCurrent();
   const operation = method === "help" ? runtime.help(requested, signal) : runtime.call(method, args ?? {}, signal);
   pending.add(operation);
   try {
    return await operation;
   } finally {
    pending.delete(operation);
    checkCurrent();
   }
  },
 };
}
function message(error: unknown) { return error instanceof Error ? error.message : String(error); }
