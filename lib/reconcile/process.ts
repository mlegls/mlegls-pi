import { closeSync, mkdirSync, openSync } from "node:fs";
import { dirname, join } from "node:path";
import { pidAlive } from "../wm";
import type { StartOptions } from "./reconcile";

/** The child waits for its predecessor to release process-local locks before reading state. */
export async function waitForPredecessor(pid?: number): Promise<void> {
	if (!pid) return;
	while (pidAlive(pid)) await Bun.sleep(100);
}

/** Own session (setsid): bb reaps idle providers by killing their process group. */
export function spawnDetached(command: string[], cwd: string, log: string, env = process.env): number {
	mkdirSync(dirname(log), { recursive: true });
	const fd = openSync(log, "a");
	try {
		const child = Bun.spawn(command, { cwd, stdio: ["ignore", fd, fd], detached: true, env: { ...env, PI_SESSION_ID: "" } });
		child.unref();
		return child.pid;
	} finally { closeSync(fd); }
}

/** Called inside the state write lock, so the child cannot save before its PID is published. */
export function spawnRun(o: StartOptions, dir: string, predecessor?: number, env = process.env): { pid: number; log: string } {
	const log = join(dir, o.root + ".log");
	const pid = spawnDetached(["bun", join(import.meta.dir, "main.ts"), "run", o.root,
		"--owner", o.owner, "--budget", String(o.budget), "--cwd", o.cwd, "--land", o.land ?? "local",
		...(o.ownerSession ? ["--owner-session", o.ownerSession] : []), ...(o.quiet ? ["--quiet"] : []),
		...(predecessor ? ["--predecessor", String(predecessor)] : [])], o.cwd, log, env);
	return { pid, log };
}
