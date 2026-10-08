import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { campaigns, start, stop, summary } from "./main";
import { load, saveState, type State } from "./reconcile";
import { allThreads, getThread } from "../thread/registry";
import { terminals } from "../thread/zmx";
import { readFrom } from "../board/store";
import { pidAlive, spawn, type Worker } from "../wm";
import type { Handle } from "../dispatch";

// Approved shell-worker smoke: explicit stop closes the run's lifetimes without discarding unmerged work.
test("stop retires live workers and handlers, keeps their unmerged branches and collectors, and reads finished/stopped", async () => {
	const root = realpathSync(mkdtempSync("/tmp/rc-stop-")), repo = join(root, "repo");
	const saved = { ...process.env }, workers: Worker[] = [];
	let pid: number | undefined, leftover: ReturnType<typeof Bun.spawn> | undefined;
	const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
	const receipt = (worker: Worker): Handle => ({ run: worker.run, handle: worker.handle, path: worker.dir, threadId: worker.threadId });
	try {
		for (const key of Object.keys(process.env)) if (/^(?:PI_WM_.*|PI_BOARD_.*|PI_SESSION_.*|AB_THREAD_ID|ZMX_.*|TMUX.*)$/.test(key)) delete process.env[key];
		Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"), PI_BOARD_DIR: join(root, "board"), PI_CODING_AGENT_DIR: join(root, "agent"), ZMX_DIR: join(root, "zmx"), MISE_TRUSTED_CONFIG_PATHS: root });
		mkdirSync(repo); git(repo, "init", "-qb", "main");
		git(repo, "config", "user.name", "Fixture"); git(repo, "config", "user.email", "fixture@example.invalid");
		mkdirSync(join(repo, "docs/issues"), { recursive: true });
		writeFileSync(join(repo, "docs/issues/fixture.md"), "---\nstage: ticket\nassignee: agent\n---\n\nShell stop fixture.\n");
		git(repo, "add", "."); git(repo, "commit", "-qm", "fixture");
		const collector = join(root, "repo__worktrees/fixture--tree");
		git(repo, "worktree", "add", "-qb", "tree/fixture", collector);
		git(repo, "config", "branch.tree/fixture.ab-parent", "main");
		const fixture = async (handle: string, cwd = repo) => {
			const worker = await spawn({ cwd, run: "fixture", handle, prompt: "Shell stop fixture", command: "sleep 120" });
			workers.push(worker);
			writeFileSync(join(worker.dir, handle + ".txt"), "unmerged " + handle + "\n");
			git(worker.dir, "add", "."); git(worker.dir, "commit", "-qm", handle);
			return worker;
		};
		const implement = await fixture("implement"), handler = await fixture("handler", collector);
		// A launch interrupted after registration but before the loop saved its receipt.
		const unrecorded = await fixture("launch-race");
		leftover = Bun.spawn(["sleep", "120"], { cwd: implement.dir, stdio: ["ignore", "ignore", "ignore"] });
		const state: State = { backend: "threads", root: "fixture", cwd: repo, owner: "mail/fixture", budget: 3,
			collectors: { fixture: { path: collector, branch: "tree/fixture", parentBranch: "main" } },
			chains: { fixture: { into: repo, self: false, phase: "implement", retries: {}, workers: [receipt(implement)],
				handle: receipt(implement), launchedAt: Date.now() } },
			exceptions: { fixture: { id: "fixture", node: "fixture", reason: "fixture", text: "", at: new Date().toISOString(),
				level: "fixture", handler: receipt(handler), handlerLaunchedAt: Date.now() } },
			tests: {}, resolved: {}, moved: {}, counter: 3, log: [] };
		saveState(state);
		pid = start({ cwd: repo, root: "fixture", owner: state.owner, budget: 3 }).pid;
		for (let i = 0; i < 100 && !readFrom(0).messages.some(m => m.body.includes("[reconcile fixture] started")); i++) await Bun.sleep(100);
		expect(readFrom(0).messages.some(m => m.body.includes("[reconcile fixture] started"))).toBe(true);
		expect(load(repo, "fixture")!.pid).toBe(pid);
		expect(campaigns(repo)[0].running).toBe(true);

		const result = await stop(repo, "fixture");
		expect(pidAlive(pid)).toBe(false);
		expect(result.finished).toBe("stopped");
		expect(result.retired.map(r => r.worker).sort()).toEqual(["fixture/handler", "fixture/implement", "fixture/launch-race"]);
		expect(await leftover.exited).not.toBe(0);
		const inventory = await terminals();
		for (const worker of [implement, handler, unrecorded]) {
			expect((await getThread(worker.threadId!))?.archived).toBe(true);
			expect(inventory.some(t => t.thread === worker.threadId || t.name.startsWith(worker.threadId + "."))).toBe(false);
			expect(existsSync(worker.dir)).toBe(false);
			expect(git(repo, "show", worker.branch + ":" + worker.handle + ".txt")).toBe("unmerged " + worker.handle);
		}
		expect(await allThreads()).toEqual([]);
		expect(existsSync(collector)).toBe(true);
		expect(git(collector, "branch", "--show-current")).toBe("tree/fixture");
		expect(load(repo, "fixture")!.collectors).toEqual(state.collectors);
		expect(summary(campaigns(repo)[0])).toMatchObject({ running: false, finished: "stopped", stopping: false, chains: {}, exceptions: {} });
		expect((await stop(repo, "fixture")).finished).toBe("stopped");
	} finally {
		if (pid && pidAlive(pid)) {
			process.kill(pid, "SIGKILL");
			for (let i = 0; i < 20 && pidAlive(pid); i++) await Bun.sleep(100);
		}
		leftover?.kill();
		await leftover?.exited;
		try { for (const worker of workers) await worker.close(true); }
		finally { process.env = saved; rmSync(root, { recursive: true, force: true }); }
	}
}, 60_000);
