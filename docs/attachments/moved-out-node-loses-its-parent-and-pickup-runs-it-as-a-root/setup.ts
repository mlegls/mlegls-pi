// Interactive first-use seed: local tracker and fake bb; no model or real bb threads.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { protocolFixture } from "../../../lib/reconcile/protocol-fixture";

const source = resolve(import.meta.dir, "../../.."), from = process.cwd();
const f = protocolFixture();
process.env.PI_RECONCILE_TICK_MS = "100";
const { run, saveState } = await import("../../../lib/reconcile/reconcile");
const controller = new AbortController();
const stopFile = join(f.root, "stop");
const poll = setInterval(() => { if (existsSync(stopFile)) controller.abort(); }, 100);
const deadline = setTimeout(() => controller.abort(), 10 * 60_000);
try {
	mkdirSync(join(f.root, "agents/roles"), { recursive: true });
	writeFileSync(join(f.root, "agents/shell.md"), "---\nrole: implement\n---\nShell fixture.\n");
	writeFileSync(join(f.root, "agents/roles/implement.md"), "Shell fixture.\n");
	f.bb.addThread("thr_owner");
	f.create("child", { "part-of": "root", stage: "goal", "claimed-by": "reconcile:root" });
	saveState({
		backend: "threads", root: "root", cwd: f.cwd, owner: "thr_owner", budget: 1,
		landed: {}, results: {}, landingOps: {}, refinements: {},
		collectors: { root: { path: f.collector, branch: "collector", parentBranch: "main" } },
		chains: { child: { into: "root", self: false, phase: "implement", held: true, retries: {}, workers: [] } },
		exceptions: { child: {
			id: "child", node: "child", reason: "needs shaping", text: "Human choice",
			at: new Date().toISOString(), level: "owner", mailed: true,
		} },
		tests: {}, resolved: {}, moved: {}, counter: 0, log: [],
	});
	console.log(JSON.stringify({
		cwd: f.cwd, owner: "thr_owner", authentication: "fake bb; no credentials",
		trackerCli: join(source, "skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"),
		reconcilerCli: join(source, "lib/reconcile/main.ts"),
		seed: "root spec, child goal with parent root, reserved by reconcile:root; owner exception awaiting resolution",
		stopFile, cleanup: "Create stopFile; the run aborts and removes the sandbox. Also exits after ten minutes.",
	}, null, 2));
	await run({ cwd: f.cwd, root: "root", owner: "thr_owner", budget: 1, signal: controller.signal });
} finally {
	clearInterval(poll); clearTimeout(deadline);
	process.chdir(from);
	f.close();
}
