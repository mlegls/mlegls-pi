import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { ComputerUseRuntime } from "./computer-use";
import type { CuaDriverLike, WindowStateOutput, WindowElement } from "@trycua/cua-driver";

type SDK = typeof import("@trycua/cua-driver");
type Root = { windowRef: string; app: string; pid: number; windowId: string; windowTitle: string };
type View = { root: Root; native: WindowStateOutput; details: any; nodes: Map<string, any>; elements: Map<string, WindowElement>; valid: boolean };
const text = (value: string) => ({ type: "text", text: value });
const normalize = (value: string) => value.replace(/^AX/, "").toLowerCase();
const json = (value: unknown) => JSON.stringify(value, (_, v) => typeof v === "bigint" ? v.toString() : v);
function bounded(value: unknown, fallback: number, max: number) {
 const n = value ?? fallback;
 if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > max) throw new Error("Expected an integer from 1 to " + max);
 return n;
}
const methods = {
 findRoots: '{app?: string} — running apps only; exact name, bundle ID, or PID. Returns windowRef values; no frontmost fallback.',
 observe: '{root: string, mode?: "semantic" | "visual", maxElements?: number, maxDepth?: number} — fresh window snapshot; invalidates prior refs for that window.',
 search: '{stateId: string, text?: string, role?: string, subrole?: string, unlabeled?: boolean, limit?: number} — cached snapshot search, not live absence evidence.',
 expand: '{stateId: string, maxElements?: number, maxDepth?: number} — recapture the window with a larger budget; replaces refs.',
 inspect: '{stateId: string, ref?: string} — cached node or outline, not a new native observation.',
 act: '{stateId: string, actions: [action], allowForeground?: boolean}. Exactly one action: press {ref}, setText {ref,text} (native AX replacement), typeText {ref,text} (insertion), scroll {ref,scrollY}, click {x,y}, key {key,modifiers?}. Background by default; no automatic foreground retry. All actions consume the observation, including failures; observe again before continuing. setText is unavailable for web content. Delivery is not proof of effect.',
 readText: '{stateId: string, ref?: string} — text from the cached snapshot.',
 waitFor: '{root: string, text: string, timeoutMs?: number, intervalMs?: number} — poll fresh AX snapshots for a substring; timeout is not proof of absence.',
};

/** Cua owns native tokens and delivery. This adapter owns only exec-shaped views and admission. */
export function createCuaRuntime(sdk: SDK, createDriver: () => CuaDriverLike = () => sdk.CuaDriver.create(undefined)): ComputerUseRuntime {
 let driver: CuaDriverLike | undefined;
 let session = "pi-" + randomUUID();
 let tail = Promise.resolve();
 const roots = new Map<string, Root>();
 const views = new Map<string, View>();
 const native = () => driver ??= createDriver();
 function exclusive<T>(signal: AbortSignal | undefined, work: () => Promise<T>): Promise<T> {
  const result = tail.then(async () => { signal?.throwIfAborted(); return work(); });
  tail = result.then(() => {}, () => {});
  return result;
 }
 function root(ref: string) {
  const value = roots.get(ref);
  if (!value) throw new Error("Unknown window ref; call ui.findRoots again");
  return value;
 }
 function view(id: string) {
  const value = views.get(id);
  if (!value || !value.valid) throw new Error("Stale or unavailable UI state; observe the window again");
  return value;
 }
 function node(v: View, ref: string) {
  const value = v.nodes.get(ref);
  if (!value) throw new Error("Unknown ref in this UI state");
  return value;
 }
 function invalidate(r: Root) { for (const v of views.values()) if (v.root.pid === r.pid && v.root.windowId === r.windowId) v.valid = false; }
 async function observe(args: any, signal?: AbortSignal) {
  const r = root(args.root);
  if (args.mode !== undefined && !["semantic", "visual"].includes(args.mode)) throw new Error("Unknown observation mode");
  invalidate(r); // A failed capture can still replace Cua's native token cache.
  const captured = await native().getWindowState(sdk.GetWindowStateInput.new({ pid: r.pid, windowId: BigInt(r.windowId), session,
   includeAccessibilityTree: true, includeScreenshot: args.mode === "visual",
   maxElements: bounded(args.maxElements, 1000, 10000), maxDepth: bounded(args.maxDepth, 30, 100),
  }), signal && { signal });
  signal?.throwIfAborted();
  if (captured.pid !== r.pid || String(captured.windowId) !== r.windowId) throw new Error("Cua returned a different window");
  const stateId = randomUUID();
  const outlineRoot: any = { ref: stateId + ":root", role: "Window", title: captured.windowTitle, children: [], truncated: captured.elementsComplete !== true };
  const nodes = new Map<string, any>([[outlineRoot.ref, outlineRoot]]);
  const elements = new Map<string, WindowElement>();
  const byIndex = new Map<string, any>();
  for (const e of captured.elements ?? []) {
   const ref = stateId + ":" + e.elementIndex;
   const role = normalize(e.role);
   const editable = /^(textfield|textarea|searchfield|combobox)$/.test(role);
   const n: any = { ref, role: e.role, title: e.label, value: e.value, description: e.valueDescription, enabled: e.enabled,
    canPress: !!e.elementToken && e.enabled !== false && (e.actions ?? []).some(a => /press|pick|confirm/i.test(a)),
    isTextInput: editable, canSetValue: !!e.elementToken && e.enabled !== false && editable && e.inWebContent !== true,
    canScroll: !!e.elementToken && /scrollarea|textarea|list|table|outline/.test(role), children: [] };
   nodes.set(ref, n); elements.set(ref, e); byIndex.set(String(e.elementIndex), n);
  }
  for (const e of captured.elements ?? []) {
   const n = byIndex.get(String(e.elementIndex));
   const parent = e.parentIndex === undefined ? outlineRoot : byIndex.get(String(e.parentIndex)) ?? outlineRoot;
   (parent === n ? outlineRoot : parent).children.push(n);
  }
  const details = { stateId, target: r, capture: { stateId, width: captured.screenshotWidth, height: captured.screenshotHeight, scaleFactor: captured.screenshotScale },
   outline: { root: outlineRoot }, text: captured.treeMarkdown?.replace(/\[(\d+)\]/g, (match, index) => byIndex.has(index) ? "[" + byIndex.get(index).ref + "]" : match) ?? [...nodes.values()].map(n => [n.ref, n.role, n.title, n.value].filter(Boolean).join(" ")).join("\n"),
   complete: captured.elementsComplete === true, degraded: captured.degraded, degradedReason: captured.degradedReason,
   totalMatches: captured.totalElementCount?.toString(), returned: captured.elements?.length ?? 0, snapshotId: captured.snapshotId };
  views.set(stateId, { root: r, native: { ...captured, images: [] }, details, nodes, elements, valid: true });
  while (views.size > 128) views.delete(views.keys().next().value!);
  return { content: [text(details.text), ...captured.images.map(i => ({ type: "image", data: i.dataBase64, mimeType: i.mimeType }))], details };
 }
 async function tool(name: string, args: any, signal?: AbortSignal) {
  const result = await native().callTool(name, JSON.stringify({ ...args, session }), signal && { signal });
  return { content: [text(result.text), ...result.images.map(i => ({ type: "image", data: i.dataBase64, mimeType: i.mimeType }))],
   isError: result.isError, details: { execution: result.structuredJson ? JSON.parse(result.structuredJson) : result.action, errorCode: result.errorCode, degraded: result.degraded } };
 }
 async function reset() {
  roots.clear(); views.clear();
  const old = driver; driver = undefined; session = "pi-" + randomUUID();
  if (old) { try { await old.shutdown(); } finally { (old as any).uniffiDestroy?.(); } }
 }
 return {
  help(method) { return Object.entries(methods).filter(([name]) => !method || name === method).map(([method, description]) => ({ method, description })); },
  exportSnapshot() { return { backend: "cua", version: 1 }; },
  // Neither old pi-computer-use refs nor Cua tokens survive runtime recreation.
  async restoreSnapshot() {},
  reset() { return exclusive(undefined, reset); },
  close() { return exclusive(undefined, reset); },
  async setup() { return process.platform === "darwin" ? sdk.requestMacOsPermissions() : { platform: process.platform }; },
  findRoots(args, signal) { return exclusive(signal, async () => {
   const apps = (await native().listApps(sdk.ListAppsInput.new({}), signal && { signal })).apps.filter(a => a.running && a.pid > 0);
   const selected = args.app === undefined ? apps : apps.filter(a => [a.name, a.bundleId, String(a.pid)].some(v => v?.toLowerCase() === String(args.app).toLowerCase()));
   const windows: Root[] = [];
   for (const app of selected) {
    signal?.throwIfAborted();
    const found = await native().listWindows(sdk.ListWindowsInput.new({ pid: app.pid, onScreenOnly: true }), signal && { signal });
    for (const w of found.windows) {
     if (w.pid !== undefined && w.pid !== app.pid) continue;
     if (w.layer !== undefined && w.layer !== 0) continue;
     const r = { windowRef: session + ":" + app.pid + ":" + w.windowId, app: args.app ?? app.name, pid: app.pid, windowId: String(w.windowId), windowTitle: w.title };
     roots.set(r.windowRef, r); windows.push(r);
    }
   }
   return { content: [text(json(windows))], details: { windows } };
  }); },
  observe(args, signal) { return exclusive(signal, () => observe(args, signal)); },
  expand(args, signal) { return exclusive(signal, () => observe({ root: view(args.stateId).root.windowRef, maxElements: args.maxElements ?? 5000, maxDepth: args.maxDepth ?? 60 }, signal)); },
  inspect(args, signal) { return exclusive(signal, async () => {
   const v = view(args.stateId); const found = args.ref ? node(v, args.ref) : v.details.outline.root;
   return { content: [text(json(found))], details: { stateId: args.stateId, node: found, scope: "cached-outline" } };
  }); },
  readText(args, signal) { return exclusive(signal, async () => {
   const v = view(args.stateId); const n = args.ref && node(v, args.ref);
   const value = n ? [n.title, n.description, n.value].filter(v => v !== undefined).join("\n") : v.details.text;
   return { content: [text(value)], details: { stateId: args.stateId, text: value, scope: "cached-outline" } };
  }); },
  search(args, signal) { return exclusive(signal, async () => {
   const v = view(args.stateId); const limit = bounded(args.limit, 50, 1000);
   const matches = [...v.nodes.values()].filter(n => (!args.role || normalize(n.role) === normalize(args.role)) &&
    (!args.subrole || normalize(n.subrole ?? "") === normalize(args.subrole)) &&
    (!args.unlabeled || !n.title) && (!args.text || json([n.title, n.description, n.value]).toLowerCase().includes(args.text.toLowerCase())));
   const results = matches.slice(0, limit).map(({ children, ...n }) => n);
   return { content: [text(json(results))], details: { stateId: args.stateId, results, returned: results.length, totalMatches: matches.length, hasMore: matches.length > limit, complete: v.details.complete, scope: "cached-outline" } };
  }); },
  act(args, signal) { return exclusive(signal, async () => {
   const v = view(args.stateId);
   if (!Array.isArray(args.actions) || args.actions.length !== 1) throw new Error("Cua requires exactly one action per observation");
   if (args.allowForeground !== undefined && typeof args.allowForeground !== "boolean") throw new Error("allowForeground must be boolean");
   const a = args.actions[0];
   const known = ["press", "setText", "typeText", "scroll", "click", "key"];
   if (!known.includes(a.action)) throw new Error("Unsupported Cua action: " + a.action);
   const e = a.ref ? (node(v, a.ref), v.elements.get(a.ref)) : undefined;
   if (["press", "setText", "typeText", "scroll"].includes(a.action) && !e?.elementToken) throw new Error("Action requires a token-bearing element ref");
   if (["setText", "typeText"].includes(a.action) && typeof a.text !== "string") throw new Error("Action requires text");
   if (a.action === "setText" && !node(v, a.ref).canSetValue) throw new Error("setText requires a native text input; web content needs renderer-aware input");
   if (a.action === "click" && ![a.x, a.y].every(Number.isFinite)) throw new Error("Click requires finite x/y screenshot coordinates");
   if (a.action === "scroll" && (!Number.isFinite(a.scrollY) || a.scrollY === 0)) throw new Error("Scroll requires a nonzero finite scrollY");
   if (a.action === "key" && typeof a.key !== "string") throw new Error("Key requires a key string");
   const windowId = BigInt(v.root.windowId);
   const target = sdk.ActionTarget.Window.new({ pid: v.root.pid, windowId });
   const deliveryMode = args.allowForeground === true ? sdk.InputDeliveryMode.Foreground : sdk.InputDeliveryMode.Background;
   // Consume before dispatch: cancellation/refusal can still follow a native effect.
   invalidate(v.root);
   if (a.action === "press" || a.action === "click") {
    const result = await native().click(sdk.ClickInput.new({ target, session, deliveryMode,
     position: e ? sdk.ClickPosition.Element.new({ elementToken: e.elementToken! }) : sdk.ClickPosition.Coordinates.new({ x: a.x, y: a.y }),
    }), signal && { signal });
    const execution = { ...result, effect: sdk.ActionEffect[result.effect], route: sdk.ActionRoute[result.route],
     delivery: result.delivery && { ...result.delivery, mode: sdk.ActionDeliveryMode[result.delivery.mode] },
     evidence: result.evidence?.map(e => ({ kind: sdk.ActionEvidenceKind[e.kind] })),
     escalation: result.escalation && { target: sdk.ActionEscalationTarget[result.escalation.target], reason: sdk.ActionEscalationReason[result.escalation.reason] } };
    return { content: [text(json(execution))], details: { stateId: args.stateId, execution } };
   }
   // These platform extensions are not yet represented by Cua's typed records.
   // Refuse unrepresentable IDs rather than round a window identity.
   if (windowId > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Cua generic action cannot encode this window ID exactly");
   const base = { pid: v.root.pid, window_id: Number(windowId), element_token: e?.elementToken, snapshot_id: v.native.snapshotId };
   if (a.action === "setText") return tool("set_value", { ...base, value: a.text }, signal);
   const delivery = { ...base, delivery_mode: args.allowForeground === true ? "foreground" : "background" };
   if (a.action === "typeText") return tool("type_text", { ...delivery, text: a.text }, signal);
   if (a.action === "key") return tool("press_key", { ...delivery, key: a.key, modifiers: a.modifiers }, signal);
   return tool("scroll", { ...delivery, direction: a.scrollY < 0 ? "up" : "down", amount: Math.min(50, Math.max(1, Math.ceil(Math.abs(a.scrollY) / 100))) }, signal);
  }); },
  waitFor(args, signal) { return exclusive(signal, async () => {
   if (typeof args.text !== "string" || !args.text) throw new Error("waitFor requires a nonempty text substring");
   const timeout = bounded(args.timeoutMs, 5000, 60000); const interval = bounded(args.intervalMs, 250, 5000);
   const deadline = Date.now() + timeout;
   for (;;) {
    signal?.throwIfAborted();
    const result = await observe({ root: args.root }, signal);
    if (result.details.text.includes(args.text)) return result;
    if (Date.now() >= deadline) return { ...result, isError: true, content: [text("Timed out waiting for text; missing from the captured projection, not proof of absence"), ...result.content] };
    await delay(Math.min(interval, deadline - Date.now()), undefined, { signal });
   }
  }); },
 };
}
