import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { threadDir } from "./registry";

/** A project's worktree setup is a mise task it declares (same discovery boundary as reconcile/checks.ts declaredGates). */
export function declaresSetup(cwd: string): Promise<boolean> {
	return new Promise(resolve => execFile("mise", ["tasks", "ls", "--json"], { cwd, encoding: "utf8" }, (error, stdout) => {
		try { resolve(!error && (JSON.parse(stdout) as { name: string }[]).some(t => t.name === "setup")); } catch { resolve(false); }
	}));
}

/** An interactive thread's setup runs beside its pi (agent-runner) rather than before it, so the pane opens at once;
 * the workspace extension tells the session how it went at its next turn. Workers still set up before launch. */
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
