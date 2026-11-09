// A takeover and reconciler launches share this lock, so a launch already in flight is
// parented before takeover enumerates children; the next launch reads the new owner.
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { git } from "../thread/git";
import { delay } from "../thread/process";

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
			if (Date.now() > deadline) throw new Error("Supervisor lock held by pid " + pid + ": " + lock);
			await delay(100);
		}
	}
	try { return await work(); } finally { rmSync(lock, { recursive: true, force: true }); }
}
