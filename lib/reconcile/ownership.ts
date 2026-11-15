// A takeover and bb thread creation share this lock: a created thread is parented before
// takeover enumerates children; a prepared checkout that hasn't launched yet reads the new owner.
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { git } from "../thread/git";
import { delay } from "../thread/process";

/** A live holder outlasted the wait; a pending launch can retry without changing its identity. */
export class OwnershipLockBusy extends Error {}

export async function ownershipLock<T>(cwd: string, work: () => Promise<T>): Promise<T> {
	const lock = join(git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"), "supervisor.lock");
	for (const deadline = Date.now() + 10 * 60_000; ;) {
		try { mkdirSync(lock); writeFileSync(join(lock, "pid"), String(process.pid)); break; }
		catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
			let pid = 0, made = Date.now();
			try { made = statSync(lock).mtimeMs; pid = Number(readFileSync(join(lock, "pid"), "utf8")); } catch {}
			let dead = !pid && Date.now() - made > 10_000;
			try { if (pid) process.kill(pid, 0); } catch { dead = true; }
			if (dead) { rmSync(lock, { recursive: true, force: true }); continue; }
			if (Date.now() > deadline) {
				const message = "Supervisor lock held by pid " + pid + ": " + lock;
				throw pid ? new OwnershipLockBusy(message) : new Error(message);
			}
			await delay(100);
		}
	}
	try { return await work(); } finally { rmSync(lock, { recursive: true, force: true }); }
}
