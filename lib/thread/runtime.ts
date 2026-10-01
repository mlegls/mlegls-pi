// Implemented by thread-registry-and-zmx-launch.
import type { NewThreadOptions, ThreadRecord, ThreadRow, ThreadSnapshot, ThreadTerminal } from "./types";

export async function newThread(_options: NewThreadOptions = {}): Promise<ThreadRecord> { throw new Error("thread runtime not implemented"); }
export async function forkThread(_source: string, _options: NewThreadOptions = {}): Promise<ThreadRecord> { throw new Error("thread runtime not implemented"); }
export async function promoteThread(_session: string, _cwd?: string): Promise<ThreadRecord> { throw new Error("thread runtime not implemented"); }
export async function threadSnapshot(_id: string): Promise<ThreadSnapshot> { throw new Error("thread runtime not implemented"); }
/** Active threads only; JSON CLI prints this whole array. Parents precede children; siblings sort by created then id. */
export async function listThreads(_options: { tree?: "spawn" | "merge"; cwd?: string } = {}): Promise<ThreadRow[]> { throw new Error("thread runtime not implemented"); }
export async function ensureTerminal(_id: string, _role = "agent"): Promise<ThreadTerminal> { throw new Error("thread runtime not implemented"); }
/** Foreground attachment/switch; callers needing a pane command use <id>.<role> directly. */
export async function attachThread(_id: string, _role = "agent"): Promise<void> { throw new Error("thread runtime not implemented"); }
/** Literal bytes. Submission callers, not this function, append a real carriage return. */
export async function sendThread(_id: string, _text: string): Promise<void> { throw new Error("thread runtime not implemented"); }
export async function historyThread(_id: string, _lines?: number): Promise<string> { throw new Error("thread runtime not implemented"); }
