import { execFile, execFileSync, spawn } from "node:child_process";
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { transientNetworkError, networkRetryDelay } from "../retry";
import { launchEnv } from "./launch";
import { delay } from "./process";
import type { WorkerCheckout } from "./types";

/** A project's worktree setup is a mise task it declares (same discovery boundary as reconcile/checks.ts declaredGates). */
export function declaresSetup(cwd: string): Promise<boolean> {
	return new Promise(resolve => execFile("mise", ["tasks", "ls", "--json"], { cwd, encoding: "utf8" }, (error, stdout) => {
		try { resolve(!error && (JSON.parse(stdout) as { name: string }[]).some(t => t.name === "setup")); } catch { resolve(false); }
	}));
}

/** How a worker's worktree setup stands, in .wm/setup.json beside the worktree (with its output in .wm/setup.log). */
export type SetupStatus =
	| { state: "running"; pid: number; log: string }
	| { state: "done"; code: number | null; log: string };

const file = (cwd: string) => join(cwd, ".wm", "setup.json");
export const setupLog = (cwd: string) => join(cwd, ".wm", "setup.log");
export function readSetup(cwd: string): SetupStatus | undefined {
	try { return existsSync(file(cwd)) ? JSON.parse(readFileSync(file(cwd), "utf8")) : undefined; } catch { return undefined; }
}
const writeSetup = (cwd: string, status: SetupStatus) => writeFileSync(file(cwd), JSON.stringify(status));

const unmerged = (cwd: string) => { try { return !!execFileSync("git", ["-C", cwd, "diff", "--name-only", "--diff-filter=U"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return false; } };

/** Run a worker's setup (mise run setup in its worktree) to completion before bb starts its pi, its output in the worktree's
 * .wm/setup.log. Transient network failures retry; a failure fails its spawn. */
export async function runSetup(thread: WorkerCheckout): Promise<void> {
	if (!await declaresSetup(thread.cwd)) return;
	// A worker handed a pending merge (a reconciler's collector refresh) would run setup over conflict markers and die
	// before it could resolve them. Its assignment says to resolve, then run setup.
	if (unmerged(thread.cwd)) return;
	mkdirSync(join(thread.cwd, ".wm"), { recursive: true });
	const log = setupLog(thread.cwd);
	writeFileSync(log, "");
	const out = openSync(log, "a");
	try {
		for (let attempt = 0; ; attempt++) {
			const offset = statSync(log).size;
			const code = await new Promise<number | null>((resolve, reject) => {
				const proc = spawn("mise", ["run", "setup"], { cwd: thread.cwd, env: launchEnv(thread), stdio: ["ignore", out, out] });
				proc.once("error", reject);
				proc.once("exit", resolve);
				if (proc.pid) writeSetup(thread.cwd, { state: "running", pid: proc.pid, log });
			});
			// Inspect only this attempt: an earlier network error must not retry a later non-network failure.
			if (code !== 0 && attempt < 2 && transientNetworkError(readFileSync(log).subarray(offset).toString())) {
				const wait = networkRetryDelay(attempt);
				appendFileSync(log, "\nWorker setup network error; retry " + (attempt + 1) + "/2 in " + wait / 1000 + "s\n");
				await delay(wait);
				continue;
			}
			writeSetup(thread.cwd, { state: "done", code, log });
			if (code !== 0) throw new Error("Worker setup failed: " + code + " (see " + log + ")");
			return;
		}
	} catch (error) {
		if (readSetup(thread.cwd)?.state !== "done") writeSetup(thread.cwd, { state: "done", code: -1, log });
		throw error;
	} finally { closeSync(out); }
}
