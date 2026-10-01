// Implemented by thread-registry-and-zmx-launch; no caller writes session JSONL through this registry.
import type { ThreadRecord } from "./types";

export async function getThread(_id: string): Promise<ThreadRecord | undefined> { throw new Error("thread registry not implemented"); }
export async function allThreads(_includeArchived = false): Promise<ThreadRecord[]> { throw new Error("thread registry not implemented"); }
export async function threadForSession(_session: string): Promise<ThreadRecord | undefined> { throw new Error("thread registry not implemented"); }
/** Unique active worker in cwd's git repository; run omitted only for a bare-handle lookup. */
export async function workerThread(_handle: string, _cwd: string, _run?: string): Promise<ThreadRecord | undefined> { throw new Error("thread registry not implemented"); }
/** Updates current identity, not thread id, parent or ownership. Used by the workspace session_switch hook. */
export async function setCurrentSession(_id: string, _session: { id: string; file: string }): Promise<void> { throw new Error("thread registry not implemented"); }
/** Atomic record replacement; lifecycle uses this for archived/blocked state. */
export async function saveThread(_thread: ThreadRecord): Promise<void> { throw new Error("thread registry not implemented"); }
