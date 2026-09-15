import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export const STATE_ENTRY = "exec-computer-use";
// Adapter v1 targets pi-computer-use 0.5.1's toolResult reconstruction contract.
// This is containment, not a native state API. Never import its stateful internals.
const pick = (value: any, keys: string) => Object.fromEntries(keys.split(" ").filter(k => ["string", "number", "boolean"].includes(typeof value?.[k])).map(k => [k, value[k]]));
const rect = (raw: any) => pick(raw, "x y w h");
const targetKeys = "app bundleId pid windowTitle windowId windowRef nativeWindowRef";
function node(raw: any): any {
 if (!raw || typeof raw.ref !== "string" || !Array.isArray(raw.children) || !Array.isArray(raw.actions) || !Array.isArray(raw.text)) throw new Error("Unsupported desktop outline node");
 const out = pick(raw, "ref wireRef role subrole identifier title description value actions canPress canFocus canSetValue canScroll canIncrement canDecrement isTextInput rect focused offscreen pictureOnly truncated scrollExtent");
 out.actions = raw.actions.filter((a: any) => typeof a === "string");
 if (raw.rect) out.rect = rect(raw.rect);
 if (raw.scrollExtent) out.scrollExtent = pick(raw.scrollExtent, "seen total");
 out.text = raw.text.map((t: any) => ({ ...pick(t, "string confidence"), ...(t.rect ? { rect: rect(t.rect) } : {}) }));
 out.children = raw.children.map(node);
 return out;
}
export function restorationDetails(raw: any): any | undefined {
 if (!raw || typeof raw !== "object") return;
 if (raw.tool === "find_roots" && Array.isArray(raw.windows)) return { tool: raw.tool, windows: raw.windows.filter((w: any) => typeof w?.windowRef === "string" && Number.isFinite(w.pid)).map((w: any) => ({ ...pick(w, targetKeys + " scaleFactor isMinimized isOnscreen isMain isFocused"), framePoints: rect(w.framePoints) })) };
 if (!raw.target || !raw.capture || !raw.outline) return;
 if (typeof raw.target.app !== "string" || !Number.isFinite(raw.target.pid) || !Number.isFinite(raw.target.windowId) || typeof raw.capture.stateId !== "string" || typeof raw.outline.lookId !== "string") return;
 try { return { tool: raw.tool, target: pick(raw.target, targetKeys), capture: pick(raw.capture, "stateId width height scaleFactor timestamp"), outline: { lookId: raw.outline.lookId, root: node(raw.outline.root) }, ...(raw.note ? { note: { ...pick(raw.note, "windowRef title pairing lastLookId"), regions: Array.isArray(raw.note.regions) ? raw.note.regions.map((r: any) => pick(r, "key label status")) : [] } } : {}) }; } catch { return; }
}
export function journal(toolName: string, raw: unknown) {
 const details = restorationDetails(raw);
 return details ? { version: 1, toolName, details } : undefined;
}
export function replayContext(ctx: ExtensionContext): ExtensionContext {
 const sessionManager = new Proxy(ctx.sessionManager, { get(target, key) {
  if (key === "getBranch") return () => target.getBranch().map((entry: any) => {
   if (entry.type !== "custom" || entry.customType !== STATE_ENTRY) return entry;
   const data = entry.data;
   // Unversioned entries are the legacy full-details journal. Re-project them.
   if (!data || (data.version !== undefined && data.version !== 1) || typeof data.toolName !== "string") return entry;
   const details = restorationDetails(data.details);
   if (!details) return entry;
   return { ...entry, type: "message", message: { role: "toolResult", toolName: data.toolName, toolCallId: entry.id, content: [], details, isError: false, timestamp: Date.parse(entry.timestamp) } };
  });
  const value = Reflect.get(target, key, target);
  return typeof value === "function" ? value.bind(target) : value;
 } });
 return new Proxy(ctx, { get: (target, key) => key === "sessionManager" ? sessionManager : Reflect.get(target, key, target) });
}
