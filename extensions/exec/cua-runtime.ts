import { randomUUID } from "node:crypto";
import type { CuaDriverLike } from "@trycua/cua-driver";
import { computerUseTools, type ComputerUseRuntime } from "./computer-use";

type SDK = typeof import("@trycua/cua-driver");
const writes = new Set(["click", "type_text", "press_key", "set_value", "scroll", "drag"]);
const reads = new Set(["list_apps", "list_windows", "get_window_state"]);
const policy = "Exec owns the Cua session. Exact pid/window_id required (no desktop/frontmost fallback). Observe before writing; pass a current element_token or snapshot_id. One write consumes that window's observation, even on error. Background by default; delivery_mode:foreground is explicit opt-in, never an automatic retry. verify_state also invalidates action tokens. Re-observe after interruption or reload.";

/** Cua's native tool protocol, without a second outline, ref system, or action language. */
export function createCuaRuntime(sdk: SDK, createDriver: () => CuaDriverLike = () => sdk.CuaDriver.create(undefined)): ComputerUseRuntime {
 let driver: CuaDriverLike | undefined;
 let session = "pi-" + randomUUID();
 let tail = Promise.resolve();
 const snapshots = new Map<string, { id: string; tokens: Set<string> }>();
 const native = () => driver ??= createDriver();
 function exclusive<T>(signal: AbortSignal | undefined, work: () => Promise<T>): Promise<T> {
  const result = tail.then(() => { signal?.throwIfAborted(); return work(); });
  tail = result.then(() => {}, () => {});
  return result;
 }
 async function reset() {
  snapshots.clear(); session = "pi-" + randomUUID();
  const old = driver; driver = undefined;
  if (old) { try { await old.shutdown(); } finally { (old as any).uniffiDestroy?.(); } }
 }
 return {
  help(method, signal) { return exclusive(signal, async () => {
   const catalog = JSON.parse(await native().listToolsJson(signal && { signal }));
   return catalog.tools.filter((t: any) => Object.hasOwn(computerUseTools, t.name) && (!method || t.name === method)).map((t: any) => ({ ...t, execPolicy: policy }));
  }); },
  reset: () => exclusive(undefined, reset), close: () => exclusive(undefined, reset),
  async setup() { return process.platform === "darwin" ? sdk.requestMacOsPermissions() : { platform: process.platform }; },
  call(method, args, signal) { return exclusive(signal, async () => {
   if (!Object.hasOwn(computerUseTools, method)) throw new Error("Unknown Cua method: " + method);
   if (args.session !== undefined) throw new Error("Exec owns the native Cua session");
   const scoped = method !== "list_apps" && method !== "list_windows";
   let key = "";
   if (scoped) {
    const pid = args.pid ?? args.target?.pid, window = args.window_id ?? args.target?.window_id;
    if (!Number.isSafeInteger(pid) || pid < 1 || !Number.isSafeInteger(window) || window < 1 || args.scope === "desktop" || (args.target && args.target.kind !== "window"))
     throw new Error("Cua requires an exact safe-integer pid/window_id; desktop fallback is disabled");
    if (args.target && ((args.pid !== undefined && args.target.pid !== args.pid) || (args.window_id !== undefined && args.target.window_id !== args.window_id))) throw new Error("Conflicting window targets");
    key = pid + ":" + window;
    if (writes.has(method)) {
     const snapshot = snapshots.get(key);
     if (!snapshot || (args.element_token ? !snapshot.tokens.has(args.element_token) : args.snapshot_id !== snapshot.id) || (args.snapshot_id !== undefined && args.snapshot_id !== snapshot.id))
      throw new Error("Stale or missing Cua observation; get_window_state before writing");
     if (args.delivery_mode !== undefined && !["background", "foreground"].includes(args.delivery_mode)) throw new Error("Invalid delivery_mode");
    }
    // Capture/verification can replace native token caches even when the call fails.
    snapshots.delete(key);
   }
   const issue = async () => {
    const input = { ...args, ...(scoped ? { session } : {}), ...(writes.has(method) && method !== "set_value" ? { delivery_mode: args.delivery_mode ?? "background" } : {}) };
    const result = await native().callTool(method, JSON.stringify(input), signal && { signal });
    signal?.throwIfAborted();
    return JSON.parse(result.rawJson);
   };
   let response = await issue();
   // The driver retires idle session labels. Start a fresh one: reads re-issue, writes need a new observation.
   if (response.structuredContent?.refusal?.code === "session_ended") {
    snapshots.clear(); session = "pi-" + randomUUID();
    if (!reads.has(method)) throw new Error("Cua session ended and was restarted; get_window_state before writing");
    response = await issue();
   }
   const state = response.structuredContent;
   if (method === "get_window_state" && !response.isError && state?.snapshot_id) {
    if (state.pid + ":" + state.window_id !== key) throw new Error("Cua returned a different window");
    snapshots.set(key, { id: state.snapshot_id, tokens: new Set((state.elements ?? []).flatMap((e: any) => e.element_token ? [e.element_token] : [])) });
   }
   return response;
  }); },
 };
}
