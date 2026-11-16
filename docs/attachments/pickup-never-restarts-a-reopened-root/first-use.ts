// Isolated pickup API replay: no bb workers or watchers are launched.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configure, loadPickup, scan } from "../../../lib/reconcile/pickup";
import { stateFile } from "../../../lib/reconcile/reconcile";

const cwd = mkdtempSync(join(tmpdir(), "pickup-reopened-"));
try {
	execFileSync("git", ["-C", cwd, "init", "-q"]);
	mkdirSync(join(cwd, "docs/issues"), { recursive: true });
	const issue = join(cwd, "docs/issues/reopened.md");
	writeFileSync(issue, "---\nstage: ticket\nassignee: agent\nauthor: session:replay\n---\nReopened work.\n");
	await configure({ cwd, owner: "thr_replay", scope: ["reopened"], settle: 0, watch: false });
	let pid = 100;
	const startRun = () => ({ pid: ++pid });
	console.log("first pickup", scan(cwd, { startRun }));
	const before = loadPickup(cwd)!.started.reopened;
	const file = stateFile(cwd, "reopened");
	mkdirSync(join(cwd, ".git/reconcile"), { recursive: true });
	const finish = (status: string) => {
		writeFileSync(file, JSON.stringify({ backend: "threads", root: "reopened", cwd,
			finished: status, moved: {}, log: [], landed: {}, results: {}, landingOps: {}, refinements: {} }));
		const at = new Date(Date.now() - 60_000);
		utimesSync(file, at, at);
	};
	finish("done");
	const old = new Date(Date.now() - 120_000);
	utimesSync(issue, old, old);
	console.log("unchanged done", scan(cwd, { startRun }));
	const reopened = new Date();
	utimesSync(issue, reopened, reopened);
	console.log("reopened done", scan(cwd, { startRun }));
	console.log("started replacement", { before, after: loadPickup(cwd)!.started.reopened });
	finish("stopped");
	console.log("changed stopped", scan(cwd, { startRun }));
} finally {
	rmSync(cwd, { recursive: true, force: true });
}
