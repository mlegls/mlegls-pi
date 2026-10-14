import { execFile, execFileSync, spawn } from "node:child_process";
import { appendFileSync, closeSync, existsSync, openSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { transientNetworkError, networkRetryDelay } from "../retry";
import { launchEnv } from "./launch";
import { delay } from "./process";
import { threadDir } from "./registry";
import type { ThreadRecord } from "./types";

/** A project's worktree setup is a mise task it declares (same discovery boundary as reconcile/checks.ts declaredGates). */
export function declaresSetup(cwd: string): Promise<boolean> {
	return new Promise(resolve => execFile("mise", ["tasks", "ls", "--json"], { cwd, encoding: "utf8" }, (error, stdout) => {
		try { resolve(!error && (JSON.parse(stdout) as { name: string }[]).some(t => t.name === "setup")); } catch { resolve(false); }
	}));
}

/** A worker's setup runs before bb starts its pi; an interactive thread's runs beside it, and the workspace extension tells
 * the session how it went at its next turn. */
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

const unmerged = (cwd: string) => { try { return !!execFileSync("git", ["-C", cwd, "diff", "--name-only", "--diff-filter=U"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return false; } };

/** Run a thread's pending setup (mise run setup in its worktree), its output in a log beside its registry record. A worker's
 * setup runs to completion before bb starts its pi, retrying transient network failures; a failure fails its spawn. An
 * interactive thread's runs beside its pi, and the workspace extension reports it at the session's next turn. */
export async function pendingSetup(thread: ThreadRecord): Promise<void> {
	if (readSetup(thread.id)?.state !== "pending") return;
	if (!await declaresSetup(thread.cwd)) return void await clearSetup(thread.id);
	// A worker handed a pending merge (a reconciler's collector refresh) would run setup over conflict markers and die
	// before it could resolve them. Its assignment says to resolve, then run setup.
	if (thread.worker && unmerged(thread.cwd)) return void await clearSetup(thread.id);
	const log = setupLog(thread.id);
	writeFileSync(log, "");
	const out = openSync(log, "a");
	const setup = async () => {
		try {
			for (let attempt = 0; ; attempt++) {
				const offset = statSync(log).size;
				const code = await new Promise<number | null>((resolve, reject) => {
					const proc = spawn("mise", ["run", "setup"], { cwd: thread.cwd, env: launchEnv(thread), stdio: ["ignore", out, out] });
					proc.once("error", reject);
					proc.once("exit", resolve);
					if (proc.pid) writeSetup(thread.id, { state: "running", pid: proc.pid, log });
				});
				// Inspect only this attempt: an earlier network error must not retry a later non-network failure.
				if (thread.worker && code !== 0 && attempt < 2 && transientNetworkError(readFileSync(log).subarray(offset).toString())) {
					const wait = networkRetryDelay(attempt);
					appendFileSync(log, "\nWorker setup network error; retry " + (attempt + 1) + "/2 in " + wait / 1000 + "s\n");
					await delay(wait);
					continue;
				}
				writeSetup(thread.id, { state: "done", code, log });
				if (thread.worker && code !== 0) throw new Error("Worker setup failed: " + code + " (see " + log + ")");
				return;
			}
		} catch (error) {
			if (readSetup(thread.id)?.state !== "done") writeSetup(thread.id, { state: "done", code: -1, log });
			throw error;
		} finally { closeSync(out); }
	};
	if (thread.worker) await setup();
	else void setup().catch(() => {});
}
