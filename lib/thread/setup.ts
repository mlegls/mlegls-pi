import { execFile, spawn } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { threadDir } from "./registry";
import type { ThreadRecord } from "./types";

/** A project's worktree setup is a mise task it declares (same discovery boundary as reconcile/checks.ts declaredGates). */
export function declaresSetup(cwd: string): Promise<boolean> {
	return new Promise(resolve => execFile("mise", ["tasks", "ls", "--json"], { cwd, encoding: "utf8" }, (error, stdout) => {
		try { resolve(!error && (JSON.parse(stdout) as { name: string }[]).some(t => t.name === "setup")); } catch { resolve(false); }
	}));
}

/** A thread's setup runs just before bb starts its pi (pendingSetup); the workspace extension tells the session how it
 * went at its next turn. A failed worker setup fails the spawn. */
export type SetupStatus =
	| { state: "pending" }
	| { state: "running"; pid: number; log: string; told?: boolean }
	| { state: "done"; code: number | null; log: string };

const file = (id: string) => join(threadDir(), id + ".setup");
export function readSetup(id: string): SetupStatus | undefined {
	try { return existsSync(file(id)) ? JSON.parse(readFileSync(file(id), "utf8")) : undefined; } catch { return undefined; }
}
export const writeSetup = (id: string, status: SetupStatus) => writeFileSync(file(id), JSON.stringify(status));
export const clearSetup = (id: string) => rm(file(id), { force: true });
export const setupLog = (id: string) => join(threadDir(), id + ".setup.log");

/** Run a thread's pending setup (mise run setup in its worktree) to completion, logging beside its registry record. A worker whose
 * setup fails fails its spawn; an interactive thread's session is told how it went. */
export async function pendingSetup(thread: ThreadRecord): Promise<void> {
	if (readSetup(thread.id)?.state !== "pending") return;
	if (!await declaresSetup(thread.cwd)) return void await clearSetup(thread.id);
	const log = setupLog(thread.id);
	const fd = openSync(log, "w");
	const code = await new Promise<number | null>(resolve => {
		const child = spawn("mise", ["run", "setup"], { cwd: thread.cwd, stdio: ["ignore", fd, fd] });
		child.once("error", () => resolve(null));
		child.once("exit", code => resolve(code));
	}).finally(() => closeSync(fd));
	writeSetup(thread.id, { state: "done", code, log });
	if (thread.worker && code !== 0) throw new Error("Worker setup (mise run setup) failed (" + (code ?? "did not start") + "); log: " + log);
}
