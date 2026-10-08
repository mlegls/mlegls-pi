import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { campaigns, stop, summary } from "./main";
import { load } from "./reconcile";
import { allThreads, getThread } from "../thread/registry";
import { terminals } from "../thread/zmx";
import { pidAlive } from "../wm";
import { cleanup, git, prepare, type Fixture } from "../../docs/attachments/stopped-supervise-jobs-have-no-cleanup-path/fixture";

// Approved shell-worker smoke: explicit stop closes the run's lifetimes without discarding unmerged work.
test("stop retires live workers and handlers, keeps their unmerged branches and collectors, and reads finished/stopped", async () => {
	const saved = { ...process.env };
	let f: Fixture | undefined;
	try {
		f = await prepare();
		const collectors = load(f.cwd, "fixture")!.collectors;
		expect(campaigns(f.cwd)[0].running).toBe(true);
		const result = await stop(f.cwd, "fixture");
		expect(pidAlive(f.pid)).toBe(false);
		expect(result.finished).toBe("stopped");
		expect(result.retired.map(r => r.worker).sort()).toEqual(["fixture/handler", "fixture/implement", "fixture/launch-race"]);
		expect(pidAlive(f.leftoverPid)).toBe(false);
		const inventory = await terminals();
		for (const { receipt: worker, branch } of f.workers) {
			expect((await getThread(worker.threadId!))?.archived).toBe(true);
			expect(inventory.some(t => t.thread === worker.threadId || t.name.startsWith(worker.threadId + "."))).toBe(false);
			expect(existsSync(worker.path)).toBe(false);
			expect(git(f.cwd, "show", branch + ":" + worker.handle + ".txt")).toBe("unmerged " + worker.handle);
		}
		expect(await allThreads()).toEqual([]);
		expect(existsSync(f.collector)).toBe(true);
		expect(git(f.collector, "branch", "--show-current")).toBe("tree/fixture");
		expect(load(f.cwd, "fixture")!.collectors).toEqual(collectors);
		expect(summary(campaigns(f.cwd)[0])).toMatchObject({ running: false, finished: "stopped", stopping: false, chains: {}, exceptions: {} });
		expect((await stop(f.cwd, "fixture")).finished).toBe("stopped");
	} finally {
		try { if (f) await cleanup(f); }
		finally { process.env = saved; }
	}
}, 60_000);
