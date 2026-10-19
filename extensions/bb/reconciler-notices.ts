import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { git } from "../../lib/thread/git.ts";
import { workerHandles, type State } from "../../lib/reconcile/reconcile.ts";

/** Only suppress completion notices whose worker receipt belongs to a live run.
 * No title heuristic: manually spawned children and reconciler tells pass through. */
export async function reconcilerCompletion(text: string, cwd: string): Promise<boolean> {
	const child = /^\[bb system\]\n\n@thread:(thr_[a-z0-9]+) completed(?:, with \d+ workflows? still running)?:\n/.exec(text)?.[1];
	if (!child) return false;
	try {
		// Run state holds each worker's bb thread id: look the child up in the live runs of cwd's repository.
		const dir = join(git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"), "reconcile");
		if (!existsSync(dir)) return false;
		// Only <run>.json is a run's state: the GitHub tracker keeps <run>.github.json journals beside it.
		for (const file of readdirSync(dir).filter(f => /^[^.]+\.json$/.test(f))) {
			const state = JSON.parse(readFileSync(join(dir, file), "utf8")) as State;
			if (state.root !== file.slice(0, -5) || !/^[a-z0-9][a-z0-9._-]*$/.test(state.root) || state.backend !== "threads" || state.finished || state.stopping
				|| !Number.isInteger(state.pid) || state.pid! <= 0) continue;
			try { process.kill(state.pid!, 0); }
			catch (error) { if ((error as NodeJS.ErrnoException).code !== "EPERM") continue; }
			if (workerHandles(state).some(receipt => receipt.bb === child && receipt.run === state.root)) return true;
		}
		return false;
	} catch {
		// Missing/stale/unreadable provenance is not authority to drop an input.
		return false;
	}
}
