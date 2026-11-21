// Drive a nested join through the reconciler CLI with disposable Git and fake BB.
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { protocolFixture } from "../../../lib/reconcile/protocol-fixture";
import { excludeTracker } from "../../../lib/thread/tracker-worktree";

const cli = resolve(import.meta.dir, "../../../lib/reconcile/main.ts");
const f = protocolFixture(), owner = "thr_owner", node = "joiner", handle = node + "-implement-1";
const fresh = process.argv.includes("--fresh");
let run: ReturnType<typeof Bun.spawn> | undefined;
const { load, saveState } = await import("../../../lib/reconcile/reconcile");
try {
	process.env.PI_RECONCILE_TICK_MS = "100";
	mkdirSync(join(f.root, "agents/roles"), { recursive: true });
	writeFileSync(join(f.root, "agents/shell.md"), "---\nrole: implement\n---\nFixture agent.\n");
	writeFileSync(join(f.root, "agents/roles/implement.md"), "Fixture role.\n");
	f.bb.addThread(owner, f.cwd);
	f.create(node, { "part-of": "root", assignee: "agent:shell" });
	f.create("direct", { "part-of": node, stage: "done" });
	f.create("joined", { "part-of": node, stage: "done" });
	const sub = join(f.root, "join-collector");
	f.git(f.cwd, "worktree", "add", "--no-checkout", "-qb", "tree/" + node, sub, "collector");
	excludeTracker(sub);
	const enclosing = f.commit(f.collector, "outer.txt", "Enclosing collector only.\n");
	const direct = f.commit(sub, "direct.txt", "Direct child landed.\n");
	const integrated = f.commit(sub, "joined.txt", "Joined child landed.\n");
	const at = new Date().toISOString(), path = join(f.cwd + "__worktrees", handle);
	const collision = "Worktree path already exists (not owned): " + path;
	if (!fresh) {
		mkdirSync(path, { recursive: true });
		writeFileSync(join(path, "orphan.txt"), "Colliding path; no registered worker.\n");
	}
	saveState({
		...f.state, backend: "threads", owner, budget: 1,
		landed: { direct: { into: node, head: direct, at }, joined: { into: node, head: integrated, at } },
		collectors: { root: { path: f.collector, branch: "collector", parentBranch: "main" },
			[node]: { path: sub, branch: "tree/" + node, parentBranch: "collector" } },
		// Resume an interrupted launch written before pending plans stored `from`.
		chains: fresh ? {} : { [node]: { into: "root", self: true, phase: "implement", base: integrated,
			launching: handle, launchPhase: "implement", retries: {}, workers: [] } },
		exceptions: {}, tests: {}, resolved: {}, moved: {}, counter: fresh ? 0 : 1, log: [],
	});
	const waitFor = async <T>(observe: () => T | undefined) => {
		for (let i = 0; i < 150; i++) {
			const value = observe();
			if (value !== undefined) return value;
			if (run?.exitCode !== null) break;
			await Bun.sleep(100);
		}
		throw new Error("No reconciler result: " + JSON.stringify(load(f.cwd, "root")?.log));
	};
	run = Bun.spawn(["bun", cli, "run", "root", "--owner", owner, "--budget", "1", "--cwd", f.cwd],
		{ env: { ...process.env, BB_THREAD_ID: owner }, stdout: "inherit", stderr: "inherit" });
	if (!fresh) {
		await waitFor(() => load(f.cwd, "root")?.log.find(line => line.includes(collision)));
		renameSync(path, join(f.root, "retained-orphan"));
		console.log("Moved the colliding path aside; waiting for the saved attempt to retry.");
	}
	const worker = await waitFor(() => load(f.cwd, "root")?.chains[node]?.handle);
	console.log(JSON.stringify({ enclosing, integrated, worker: worker.handle,
		workerHead: f.git(worker.path, "rev-parse", "HEAD"),
		landingBranch: f.git(worker.path, "config", "branch." + worker.handle + ".ab-parent"),
		files: f.git(worker.path, "ls-tree", "--name-only", "HEAD").split("\n"),
	}, null, 2));
} finally {
	run?.kill();
	await run?.exited;
	f.close();
}
