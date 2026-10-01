import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, wait, type Worker } from "./wm";
import { send } from "./board/store";

// Opt in: starts harmless local shell worker threads over isolated zmx, never a model or paid API.
test.skipIf(process.env.PI_TEST_LOCAL_WM !== "1")("concurrent thread workers preserve any/all reports and close removes owned worktrees", async () => {
	const root = await mkdtemp("/tmp/wm-user-");
	const cwd = join(root, "repo"), run = `verify-${process.pid}-${Date.now()}`;
	const oldBoard = process.env.PI_BOARD_DIR;
	const oldState = process.env.XDG_STATE_HOME, oldZmx = process.env.ZMX_DIR, oldAgent = process.env.PI_CODING_AGENT_DIR;
	process.env.XDG_STATE_HOME = join(root, "state");
	process.env.ZMX_DIR = join(root, "zmx");
	process.env.PI_CODING_AGENT_DIR = join(root, "pi");
	process.env.PI_BOARD_DIR = join(root, "board");
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
		const spawned = await Promise.allSettled(["a", "b"].map(handle => spawn({ cwd, run, handle, prompt: "local fixture", command: "sleep 120" })));
		workers = spawned.flatMap(r => r.status === "fulfilled" ? [r.value] : []);
		expect(spawned.filter(r => r.status === "rejected").map(r => (r as PromiseRejectedResult).reason.message)).toEqual([]);
		expect((await command(["git", "worktree", "list", "--porcelain"], cwd)).match(/^worktree /gm)).toHaveLength(3);
		const report = (handle: string, body: string) => send({ topic: `${run}/${handle}`, tags: ["done"], body, from: { name: handle, session: run, cwd } });
		const first = wait(workers, { mode: "any", timeoutMs: 5000 });
		report("b", "first");
		expect([...(await first).keys()].map(w => w.handle)).toEqual(["b"]);
		report("a", "second");
		report("b", "third");
		const rest = await wait(workers, { mode: "all", timeoutMs: 5000 });
		expect([...rest.values()].map(o => "message" in o && o.message ? o.message.body : o.kind).sort()).toEqual(["second", "third"]);
		await Promise.all(workers.map(w => w.close()));
		expect((await command(["git", "worktree", "list", "--porcelain"], cwd)).match(/^worktree /gm)).toHaveLength(1);
	} finally {
		await Promise.all(workers.map(w => w.close()));
		if (oldBoard === undefined) delete process.env.PI_BOARD_DIR; else process.env.PI_BOARD_DIR = oldBoard;
		for (const [key, value] of Object.entries({ XDG_STATE_HOME: oldState, ZMX_DIR: oldZmx, PI_CODING_AGENT_DIR: oldAgent })) {
			if (value === undefined) delete process.env[key]; else process.env[key] = value;
		}
		await rm(root, { recursive: true, force: true });
	}
}, 30000);
