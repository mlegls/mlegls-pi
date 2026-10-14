import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { campaigns, stop, summary } from "./main";
import { load } from "./reconcile";
import { allThreads, getThread } from "../thread/registry";
import { threads } from "../thread/fake-bb";
import { pidAlive } from "../wm";
import { cleanup, git, prepare, type Fixture } from "../../docs/attachments/stopped-supervise-jobs-have-no-cleanup-path/fixture";

// Approved fake-bb smoke: explicit stop closes the run's lifetimes without discarding unmerged work.
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
		const bbThreads = threads(join(f.root, "fake-bb"));
		for (const { receipt: worker, branch } of f.workers) {
			expect((await getThread(worker.threadId!))?.archived).toBe(true);
			const bb = bbThreads.find(t => t.environment === worker.path);
			expect(bb?.archivedAt).not.toBeNull();
			expect(bb?.status).toBe("idle");
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
