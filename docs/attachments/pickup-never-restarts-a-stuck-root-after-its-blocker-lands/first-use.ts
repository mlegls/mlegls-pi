// Replay the joined-5000 collector race through pickup scan and a real reconciler with fake bb.
import { mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { protocolFixture } from "../../../lib/reconcile/protocol-fixture";
import { configure, scan } from "../../../lib/reconcile/pickup";
import { stop } from "../../../lib/reconcile/main";
import { load, saveState, type State } from "../../../lib/reconcile/reconcile";

const f = protocolFixture();
const root = "joined-5000-profile-practice-and-map-stay-loading";
const blocker = "shorten-compact-capture-and-first-bodies-in-fresh-practice";
const child = "finish-joined-5000-practice";
const unchanged = "unchanged-stuck-ticket";
const owner = "thr_owner";
try {
	process.env.PI_RECONCILE_TICK_MS = "100";
	mkdirSync(join(f.root, "agents/roles"), { recursive: true });
	writeFileSync(join(f.root, "agents/shell.md"), "---\nrole: implement\n---\nShell fixture.\n");
	writeFileSync(join(f.root, "agents/roles/implement.md"), "Shell fixture.\n");
	f.bb.addThread(owner);
	f.create(root, { stage: "ready", decompose: true });
	f.create(blocker, { "part-of": root, assignee: "human" });
	f.create(child, { "part-of": root, "blocked-by": [blocker], assignee: "agent:shell", priority: 1 });
	f.create(unchanged);
	const finishedAt = Date.now() - 120_000;
	const old = new Date(finishedAt - 1_000);
	for (const slug of [root, blocker, child, unchanged]) utimesSync(join(f.cwd, "docs/issues", slug + ".md"), old, old);
	const stuck: State = { ...f.state, root, backend: "threads", owner, budget: 1,
		finished: "stuck", finishedAt, collectors: { [root]: { path: f.collector, branch: "collector", parentBranch: "main" } },
		chains: {}, exceptions: {}, tests: {}, resolved: {}, moved: {}, counter: 0, log: [] };
	await configure({ cwd: f.cwd, owner, scope: [root, unchanged], budget: 1, watch: false });
	saveState(stuck);
	saveState({ ...stuck, root: unchanged, collectors: {} });
	console.log("unchanged stuck:", scan(f.cwd));
	const issue = join(f.cwd, "docs/issues", child + ".md"), edited = new Date(finishedAt + 500);
	utimesSync(issue, edited, edited);
	console.log("subtree issue edited at T+0.5s (selection only):", scan(f.cwd, { startRun: () => ({ pid: 0 }) }));
	utimesSync(issue, old, old);
	const head = f.commit(f.collector, "capture.txt", "reviewed blocker delivery\n");
	saveState({ ...stuck, landed: { [blocker]: { into: root, head, at: new Date(finishedAt + 500).toISOString() } } });
	const picked = scan(f.cwd);
	console.log("collector receipt at T+0.5s:", picked);
	if (!picked.started.includes(root)) throw new Error("Pickup did not restart the stuck root");
	console.log("scan while restarting:", scan(f.cwd));
	for (let i = 0; i < 100; i++) {
		const current = load(f.cwd, root);
		const handle = current?.chains[child]?.handle;
		if (handle) {
			console.log("dependent launched:", handle.handle, "collector receipt retained:", current.landed[blocker]?.head === head,
				"worker based on delivery:", f.git(handle.path, "rev-parse", "HEAD") === head);
			break;
		}
		if (current?.finished || i === 99) throw new Error("Dependent did not launch: " + JSON.stringify(current));
		await Bun.sleep(100);
	}
} finally {
	try { if (load(f.cwd, root)?.pid) await stop(f.cwd, root); }
	finally { f.close(); }
}
