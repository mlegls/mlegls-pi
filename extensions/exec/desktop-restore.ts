import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export const STATE_ENTRY = "exec-computer-use";
/** Opaque runtime-owned, image-free incremental snapshot. Not a Pi tool result. */
export function journal(snapshot: unknown) { return { version: 2, snapshot }; }
export function restorationRecords(ctx: ExtensionContext) {
 const snapshots: unknown[] = [];
 let legacy = false;
 for (const entry of ctx.sessionManager.getBranch()) {
  if (entry.type !== "custom" || entry.customType !== STATE_ENTRY) continue;
  const data = entry.data as any;
  if (data?.version === undefined || data?.version === 1) { legacy = true; continue; }
  if (data?.version !== 2 || !Object.hasOwn(data, "snapshot")) throw new Error("Unsupported exec UI journal version or missing snapshot");
  snapshots.push(data.snapshot);
 }
 return { snapshots, legacy };
}
