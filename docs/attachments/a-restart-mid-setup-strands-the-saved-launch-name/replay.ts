// Seed the disk state just after an interrupted setup, then start the real reconciler against fake BB.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { start, stop } from "../../../lib/reconcile/main";
import { protocolFixture } from "../../../lib/reconcile/protocol-fixture";
import { load, saveState } from "../../../lib/reconcile/reconcile";
import { excludeTracker } from "../../../lib/thread/tracker-worktree";
import { until } from "../../../lib/reconcile/setup-fixture";
import { excludeWm } from "../../../lib/wm";

const mode = process.argv[2] ?? "clean";
if (!["clean", "dirty"].includes(mode)) throw new Error("Choose clean or dirty");
const f = protocolFixture();
let running = false;
try {
	process.env.PI_RECONCILE_TICK_MS = "200";
	mkdirSync(join(f.root, "agents/roles"), { recursive: true });
	writeFileSync(join(f.root, "agents/shell.md"), "---\nrole: implement\n---\nOffline worker.\n");
	writeFileSync(join(f.root, "agents/roles/implement.md"), "Offline worker.\n");
	f.tracker.update("root", { stage: "ticket", assignee: "agent:shell" });
	f.bb.addThread("thr_owner");
	const launching = "root-implement-1", path = join(f.cwd + "__worktrees", launching);
	f.git(f.cwd, "worktree", "add", "--no-checkout", "-b", launching, path, "HEAD");
	excludeTracker(path);
	await excludeWm(path);
	f.git(path, "config", "branch." + launching + ".ab-parent", "main");
	mkdirSync(join(path, ".wm"));
	writeFileSync(join(path, ".wm/setup.log"), "setup interrupted before BB spawn\n");
	if (mode === "dirty") writeFileSync(join(path, "code.txt"), "keep this edit\n");
	saveState({ backend: "threads", root: "root", cwd: f.cwd, owner: "thr_owner", budget: 1,
		landed: {}, results: {}, landingOps: {}, refinements: {}, collectors: {},
		chains: { root: { into: f.cwd, self: false, phase: "implement", launching, launchPhase: "implement", retries: {}, workers: [] } },
		exceptions: {}, tests: {}, resolved: {}, moved: {}, counter: 1, log: [] });
	console.log(JSON.stringify({ seed: mode, path, status: f.git(path, "status", "--porcelain"), threads: f.bb.threads().map(t => t.title) }));
	start({ cwd: f.cwd, root: "root", owner: "thr_owner", budget: 1 });
	running = true;
	await until(() => {
		const s = load(f.cwd, "root");
		return s?.chains.root?.handle || s?.exceptions.root?.mailed;
	});
	await Bun.sleep(1000);
	const state = load(f.cwd, "root")!;
	console.log(JSON.stringify({
		handle: state.chains.root?.handle?.handle,
		exception: state.exceptions.root,
		status: f.git(path, "status", "--porcelain"),
		spawns: f.bb.calls().filter(call => call.slice(0, 5).join(" ") === "plugin rpc call supervision workerSpawn").length,
		log: state.log,
	}, null, 2));
} finally {
	if (running) await stop(f.cwd, "root");
	f.close();
}
