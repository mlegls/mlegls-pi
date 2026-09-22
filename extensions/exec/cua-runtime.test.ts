import { expect, test } from "bun:test";
import * as sdk from "@trycua/cua-driver";
import recording from "./fixtures/cua-textedit-0.28.2.json";
import { createCuaRuntime } from "./cua-runtime";

// Replay the reviewed TextEdit encounter in docs/guide/cua-background.md.
// Historical native tokens terminate at this fake driver, never the desktop.
test("background TextEdit replacement, checked refs, and button delivery", async () => {
 const records = structuredClone(recording.record);
 const calls: Array<{ method: string; args: any }> = [];
 const revive = (value: any): any => {
  if (Array.isArray(value)) return value.map(revive);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, /^(windowId|elementIndex|parentIndex|elementCount|totalElementCount|returnedElementCount)$/.test(k) && typeof v === "string" ? BigInt(v) : revive(v)]));
  return value;
 };
 const driver = {
  async listApps() { return { apps: [{ pid: recording.window.pid, name: "TextEdit", running: true }] }; },
  async listWindows() { return { windows: [{ pid: recording.window.pid, windowId: BigInt(recording.window.windowId), title: "Untitled", layer: 0 }] }; },
  async shutdown() {},
  ...Object.fromEntries(["getWindowState", "callTool", "click"].map(method => [method, async (...args: any[]) => {
   calls.push({ method, args });
   const next = records.shift()!;
   expect(next.method).toBe(method);
   return revive(next.result);
  }])),
 };
 const ui = createCuaRuntime(sdk, () => driver as any);
 try {
  const found = await ui.findRoots({ app: "TextEdit" });
  const root = (found.details as any).windows[0].windowRef;
  let observation = await ui.observe({ root });
  let details = observation.details as any;
  const field = details.outline.root.children.find((n: any) => n.role === "AXTextArea");
  expect(field.canSetValue).toBe(true); // Cua omits inWebContent for native controls.
  expect(details.text).toContain(field.ref); // Printed observations must expose usable refs.
  expect(field.value).toBe("Cua background probe");
  expect(details.complete).toBe(false);
  const result = await ui.act({ stateId: details.stateId, actions: [{ action: "setText", ref: field.ref, text: "Cua background replacement works" }] });
  expect(result.isError).toBe(false);
  expect((result.details as any).execution.delivery.mode).toBe("background");
  const write = calls.find(c => c.method === "callTool")!;
  expect(write.args[0]).toBe("set_value");
  expect(JSON.parse(write.args[1]).value).toBe("Cua background replacement works");
  await expect(ui.inspect({ stateId: details.stateId, ref: field.ref })).rejects.toThrow("Stale");
  observation = await ui.observe({ root }); details = observation.details as any;
  expect(details.outline.root.children.find((n: any) => n.role === "AXTextArea").value).toBe("Cua background replacement works");
  const bold = details.outline.root.children.find((n: any) => n.title === "bold");
  const pressed = await ui.act({ stateId: details.stateId, actions: [{ action: "press", ref: bold.ref }] });
  expect(calls.at(-1)!.args[0].deliveryMode).toBe(sdk.InputDeliveryMode.Background);
  expect(calls.at(-1)!.args[0].target.inner.windowId).toBe(BigInt(recording.window.windowId));
  expect((pressed.details as any).execution.effect).toBe("Unverifiable");
  await ui.reset();
  await expect(ui.observe({ root })).rejects.toThrow("Unknown window ref");
  expect(records).toHaveLength(0);
 } finally { await ui.close(); }
});
