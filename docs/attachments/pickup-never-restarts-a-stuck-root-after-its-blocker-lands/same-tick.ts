// Drive a walk with one held child and its reviewed sibling ready for integration.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { protocolFixture } from "../../../lib/reconcile/protocol-fixture";
import { load, saveState } from "../../../lib/reconcile/reconcile";
import { start, stop } from "../../../lib/reconcile/main";

const f = protocolFixture(), owner = "thr_owner";
try {
	process.env.PI_RECONCILE_TICK_MS = "60000";
	mkdirSync(join(f.root, "agents/roles"), { recursive: true });
	writeFileSync(join(f.root, "agents/shell.md"), "---\nrole: implement\n---\nShell fixture.\n");
	writeFileSync(join(f.root, "agents/roles/implement.md"), "Shell fixture.\n");
	f.bb.addThread(owner);
	f.create("dependent", { "part-of": "root", "blocked-by": ["blocker"], assignee: "agent:shell" });
	f.create("blocker", { "part-of": "root" });
	const handle = f.worker("blocker-review"), delivery = f.commit(handle.path, "delivery.txt", "reviewed\n");
	saveState({ ...f.state, backend: "threads", owner, budget: 1,
		collectors: { root: { path: f.collector, branch: "collector", parentBranch: "main" } },
		chains: { blocker: { into: "root", self: false, phase: "integrate", retries: {}, workers: [], handle } },
		results: { blocker: { parent: "root", summary: "blocker reviewed", handoff: {} } },
		exceptions: {}, tests: {}, resolved: {}, moved: {}, counter: 0, log: [] });
	const began = Date.now();
	start({ cwd: f.cwd, root: "root", owner, budget: 1 });
	for (;;) {
		const s = load(f.cwd, "root")!;
		if (Date.now() - began > 15000 || s.finished || Object.keys(s.exceptions).length) throw Error(JSON.stringify(s));
		const worker = s.chains.dependent?.handle;
		if (worker && s.landed.blocker?.head === delivery && f.git(worker.path, "rev-parse", "HEAD") === delivery) {
			console.log(s.log, "Dependent based on delivery after", Date.now() - began, "ms; tick interval 60000 ms");
			break;
		}
		await Bun.sleep(100);
	}
} finally {
	try { if (load(f.cwd, "root")?.pid) await stop(f.cwd, "root"); }
	finally { f.close(); }
}
