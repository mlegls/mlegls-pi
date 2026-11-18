// Rehearse the first walk after a sibling landing, using a disposable repo and fake bb.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { protocolFixture } from "../../../lib/reconcile/protocol-fixture";
import { excludeTracker } from "../../../lib/thread/tracker-worktree";

const cli = resolve(import.meta.dir, "../../../lib/reconcile/main.ts");
const f = protocolFixture(), owner = "thr_owner", sub = join(f.root, "dependent-tree");
const { load, saveState } = await import("../../../lib/reconcile/reconcile");
let child: ReturnType<typeof Bun.spawn> | undefined;
try {
	process.env.PI_RECONCILE_TICK_MS = "100";
	mkdirSync(join(f.root, "agents/roles"), { recursive: true });
	writeFileSync(join(f.root, "agents/shell.md"), "---\nrole: implement\n---\nFixture agent.\n");
	writeFileSync(join(f.root, "agents/roles/implement.md"), "Fixture role.\n");
	f.bb.addThread(owner, f.cwd);
	f.create("prerequisite", { "part-of": "root" });
	f.create("dependent", { "part-of": "root", "blocked-by": ["prerequisite"], assignee: "agent:shell" });
	f.git(f.cwd, "worktree", "add", "--no-checkout", "-qb", "tree/dependent", sub, "collector");
	excludeTracker(sub);
	const before = f.git(sub, "rev-parse", "HEAD");
	const head = f.commit(f.collector, "prerequisite.txt", "Delivered in the shared parent collector.\n");
	saveState({
		...f.state, backend: "threads", owner, budget: 1,
		landed: { prerequisite: { into: "root", head, at: new Date().toISOString() } },
		collectors: {
			root: { path: f.collector, branch: "collector", parentBranch: "main" },
			dependent: { path: sub, branch: "tree/dependent", parentBranch: "collector" },
		},
		chains: {}, exceptions: {}, tests: {}, resolved: {}, moved: {}, counter: 0, log: [],
	});
	console.log(JSON.stringify({ repo: f.cwd, owner, nestedBefore: before, parentHead: head }, null, 2));
	child = Bun.spawn(["bun", cli, "run", "root", "--owner", owner, "--budget", "1", "--cwd", f.cwd], { env: { ...process.env }, stdout: "inherit", stderr: "inherit" });
	const deadline = Date.now() + 30_000;
	for (;;) {
		const s = load(f.cwd, "root")!;
		const worker = s.chains.dependent?.handle;
		if (s.finished || worker || s.exceptions.dependent) {
			console.log(JSON.stringify({
				finished: s.finished ?? null, nestedAfter: f.git(sub, "rev-parse", "HEAD"),
				worker: worker && { name: worker.handle, head: f.git(worker.path, "rev-parse", "HEAD") },
				exception: s.exceptions.dependent?.reason, log: s.log,
			}, null, 2));
			if (s.finished) {
				await child.exited;
				console.log(f.bb.threads().find(t => t.id === owner)?.tells.at(-1));
			}
			break;
		}
		if (child.exitCode !== null) throw new Error("Reconciler exited before reaching a walk outcome");
		if (Date.now() >= deadline) throw new Error("No walk outcome within 30 seconds");
		await Bun.sleep(100);
	}
} finally {
	child?.kill();
	await child?.exited;
	f.close();
}
