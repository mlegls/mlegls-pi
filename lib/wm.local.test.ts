import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, wait, type Worker } from "./wm";
import { fakeBb } from "./thread/fake-bb";

// Opt in: starts worker threads on a fake bb CLI, never a daemon, model or paid API.
test.skipIf(process.env.PI_TEST_LOCAL_WM !== "1")("concurrent thread workers preserve any/all reports and close removes owned worktrees", async () => {
	const root = await mkdtemp("/tmp/wm-user-");
	const cwd = join(root, "repo"), run = `verify-${process.pid}-${Date.now()}`;
	const oldState = process.env.XDG_STATE_HOME, oldBbCli = process.env.BB_CLI, oldFakeBb = process.env.FAKE_BB_DIR, oldAgent = process.env.PI_CODING_AGENT_DIR;
	process.env.XDG_STATE_HOME = join(root, "state");
	const bb = fakeBb(root);
	process.env.PI_CODING_AGENT_DIR = join(root, "pi");
	const command = async (cmd: string[], dir = root) => {
		const p = Bun.spawn(cmd, { cwd: dir, stdout: "pipe", stderr: "pipe" });
		const [code, stdout, stderr] = await Promise.all([p.exited, new Response(p.stdout).text(), new Response(p.stderr).text()]);
		if (code) throw new Error(`${cmd.join(" ")}: ${stderr}`);
		return stdout;
	};
	let workers: Worker[] = [];
	try {
		await command(["git", "init", cwd]);
		await command(["git", "-c", "user.name=Verifier", "-c", "user.email=verify@example.invalid", "commit", "--allow-empty", "-m", "fixture"], cwd);
		const spawned = await Promise.allSettled(["a", "b"].map(handle => spawn({ cwd, run, handle, prompt: "local fixture", model: "fake/model", effort: "low" })));
		workers = spawned.flatMap(r => r.status === "fulfilled" ? [r.value] : []);
		expect(spawned.filter(r => r.status === "rejected").map(r => (r as PromiseRejectedResult).reason.message)).toEqual([]);
		expect((await command(["git", "worktree", "list", "--porcelain"], cwd)).match(/^worktree /gm)).toHaveLength(3);
		const report = (handle: string, body: string) => bb.completeTurn(workers.find(w => w.handle === handle)!.dir, "done " + body);
		const first = wait(workers, { mode: "any", timeoutMs: 5000 });
		report("b", "first");
		expect([...(await first).keys()].map(w => w.handle)).toEqual(["b"]);
		report("a", "second");
		report("b", "third");
		const rest = await wait(workers, { mode: "all", timeoutMs: 5000 });
		expect([...rest.values()].map(o => "message" in o && o.message ? o.message.body : o.kind).sort()).toEqual(["done second", "done third"]);
		await Promise.all(workers.map(w => w.close()));
		expect((await command(["git", "worktree", "list", "--porcelain"], cwd)).match(/^worktree /gm)).toHaveLength(1);
	} finally {
		await Promise.all(workers.map(w => w.close()));
		for (const [key, value] of Object.entries({ XDG_STATE_HOME: oldState, BB_CLI: oldBbCli, FAKE_BB_DIR: oldFakeBb, PI_CODING_AGENT_DIR: oldAgent })) {
			if (value === undefined) delete process.env[key]; else process.env[key] = value;
		}
		await rm(root, { recursive: true, force: true });
	}
}, 30000);
