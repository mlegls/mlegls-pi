// Run a real reconciler tick loop against disposable BB threads and Pi session receipts.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { protocolFixture } from "../../../lib/reconcile/protocol-fixture";
import { writeLive } from "../../../lib/session-meta/live";

for (const [label, status, ageMinutes] of [
	["running past the early threshold", "running", 3],
	["older backend, no registry", null, 3],
	["exited without a wake", "exited", 3],
	["no registry past the ordinary threshold", null, 31],
] as const) {
	const f = protocolFixture(), from = process.cwd();
	try {
		process.env.PI_RECONCILE_TICK_MS = "100";
		const r = await import("../../../lib/reconcile/reconcile");
		f.create("fixture", { "part-of": "root" });
		f.bb.addThread("thr_owner");
		const path = join(f.root, "worker");
		f.git(f.cwd, "worktree", "add", "-qb", "fixture-implement-1", path, "collector");
		const handle = f.bare("root", "fixture-implement-1", path);
		const sessionFile = join(f.root, "worker.jsonl");
		const since = new Date(Date.now() - ageMinutes * 60_000).toISOString();
		writeLive({ pid: process.pid, sessionId: "worker-session", thread: handle.bb, sessionFile, cwd: path, state: "idle", since });
		if (status) {
			mkdirSync(sessionFile + ".processes");
			writeFileSync(join(sessionFile + ".processes", "registry.json"), JSON.stringify({ version: 1, records: [{ info: { name: "import", status } }] }));
		}
		r.saveState({ backend: "threads", root: "root", cwd: f.cwd, owner: "thr_owner", budget: 0,
			landed: {}, results: {}, landingOps: {}, refinements: {}, exceptions: {}, tests: {}, resolved: {}, moved: {}, counter: 0, log: [],
			collectors: { root: { path: f.collector, branch: "collector", parentBranch: "main" } },
			chains: { fixture: { into: "root", self: false, phase: "implement", retries: {}, workers: [], handle,
				launchedAt: Date.parse(since) - 1000, handledTs: since, waitingSince: since } },
		});
		const polls = () => f.bb.calls().filter(args => args[0] === "thread" && args[1] === "list").length;
		const controller = new AbortController();
		const check = setInterval(() => { if (polls() >= 4) controller.abort(); }, 50);
		const deadline = setTimeout(() => controller.abort(), 10_000);
		try { await r.run({ cwd: f.cwd, root: "root", owner: "thr_owner", budget: 0, signal: controller.signal }); }
		finally { clearInterval(check); clearTimeout(deadline); }
		if (polls() < 4) throw new Error("Reconciler did not reach four BB observations");
		const worker = f.bb.threads().find(t => t.id === handle.bb)!;
		console.log(JSON.stringify({ encounter: label, workerInbox: worker.tells }));
	} finally {
		process.chdir(from);
		f.close();
	}
}
