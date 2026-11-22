import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveState, type State } from "../../lib/reconcile/reconcile";
import { reconcilerCompletion } from "./reconciler-notices";

async function fixture(drive: (cwd: string, state: State) => Promise<void>) {
	const cwd = mkdtempSync(join(tmpdir(), "notice-receipts-"));
	try {
		execFileSync("git", ["init", "-q", cwd]);
		const state: State = {
			backend: "threads", root: "notice", cwd, owner: "thr_owner", budget: 1, pid: process.pid,
			chains: { ticket: { phase: "implement", into: cwd, self: false, retries: {},
				handle: { run: "notice", handle: "implement", path: cwd, bb: "thr_current" },
				workers: [{ run: "notice", handle: "retired", path: cwd, bb: "thr_previous" }] } },
			landed: {}, results: {}, landingOps: {}, refinements: {}, collectors: {}, exceptions: {},
			tests: {}, resolved: {}, moved: {}, counter: 0, log: [],
		};
		saveState(state);
		await drive(cwd, state);
	} finally { rmSync(cwd, { recursive: true, force: true }); }
}

test("a grouped BB notice settles only if every child has a worker receipt", () => fixture(async cwd => {
	const group = (other: string) => "[bb system]\n\nChild thread updates:\n\n- @thread:thr_current completed.\n- @thread:" + other + " completed.";
	expect(await reconcilerCompletion(group("thr_previous"), cwd)).toBe(true);
	expect(await reconcilerCompletion(group("thr_human"), cwd)).toBe(false);
}));

test("a worker completion still settles from disk after removing its handles and stopping its run", () => fixture(async (cwd, state) => {
	const notice = "[bb system]\n\n@thread:thr_current completed:\n\ndone";
	for (const stage of [{}, { finished: "done", pid: undefined }, { stopping: true }, { finished: "stopped", pid: undefined }]) {
		saveState({ ...state, chains: {}, workerThreads: undefined, ...stage });
		expect(await reconcilerCompletion(notice, cwd)).toBe(true);
	}
	const replay = Bun.spawnSync([process.execPath, "-e",
		"import { reconcilerCompletion } from " + JSON.stringify(join(import.meta.dir, "reconciler-notices.ts"))
		+ "; if (!await reconcilerCompletion(...JSON.parse(process.argv[1]))) process.exit(1)", JSON.stringify([notice, cwd])]);
	expect(replay.exitCode).toBe(0);
	expect(await reconcilerCompletion(notice.replace("thr_current", "thr_unowned"), cwd)).toBe(false);
}));
