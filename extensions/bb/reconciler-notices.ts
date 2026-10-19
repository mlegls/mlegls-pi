import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { git } from "../../lib/thread/git.ts";
import { bbIndex, getThread } from "../../lib/thread/registry.ts";
import type { State } from "../../lib/reconcile/reconcile.ts";

/** Only suppress completion notices whose worker receipt belongs to a live run.
 * No title heuristic: manually spawned children and reconciler tells pass through. */
export async function reconcilerCompletion(text: string, cwd: string): Promise<boolean> {
	const child = /^\[bb system\]\n\n@thread:(thr_[a-z0-9]+) completed(?:, with \d+ workflows? still running)?:\n/.exec(text)?.[1];
	if (!child) return false;
	try {
		const id = Object.entries(bbIndex()).find(([, entry]) => entry.bb === child)?.[0];
		if (!id) return false;
		const worker = await getThread(id);
		const run = worker?.worker?.run;
		if (!worker || worker.archived || !run || !/^[a-z0-9][a-z0-9._-]*$/.test(run)) return false;
		const common = git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir");
		if (git(worker.project, "rev-parse", "--path-format=absolute", "--git-common-dir") !== common) return false;
		const state = JSON.parse(await readFile(join(common, "reconcile", run + ".json"), "utf8")) as State;
		if (state.root !== run || state.backend !== "threads" || state.finished || state.stopping || !Number.isInteger(state.pid) || state.pid! <= 0) return false;
		try { process.kill(state.pid!, 0); }
		catch (error) { if ((error as NodeJS.ErrnoException).code !== "EPERM") return false; }
		const receipts = [
			...Object.values(state.chains ?? {}).flatMap(chain => [chain.handle, ...(chain.workers ?? [])]),
			...Object.values(state.exceptions ?? {}).map(exception => exception.handler),
			...Object.values(state.refinements ?? {}).map(attempt => attempt.worker),
			state.pr?.repair?.worker,
			...(state.pr?.repairHistory ?? []).map(repair => repair.worker),
		];
		return receipts.some(receipt => receipt?.threadId === id && receipt.run === run && receipt.handle === worker.worker!.handle);
	} catch {
		// Missing/stale/unreadable provenance is not authority to drop an input.
		return false;
	}
}
