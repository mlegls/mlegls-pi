// First-use fixture: two independent launch owners share one isolated GNU sem pool.
// No pi/model calls. "cleanup" retires registered workers before deleting the owned fixture.
import { chmodSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dispatch } from "../../../lib/dispatch";
import { campaigns, summary } from "../../../lib/reconcile/main";
import { saveState } from "../../../lib/reconcile/reconcile";
import { allThreads } from "../../../lib/thread/registry";
import { abandonThread, listThreads } from "../../../lib/thread";
import { command, quote } from "../../../lib/thread/process";
import { thread as threadCLI } from "../../../lib/thread/cli";
import { readAdmission } from "../../../lib/thread/admission";

function environment(root: string) {
	if (!existsSync(join(root, "fixture.json"))) throw new Error("Not a worker admission fixture: " + root);
	for (const key of Object.keys(process.env)) if (/^(?:PI_WM_.*|PI_BOARD_.*|PI_SESSION_.*|AB_THREAD_ID|BB_.*|PI_THREAD_RUNTIME|ZMX_.*|TMUX.*|WORKER_.*)$/.test(key)) delete process.env[key];
	Object.assign(process.env, {
		XDG_STATE_HOME: join(root, "state"), PI_BOARD_DIR: join(root, "board"),
		XDG_CACHE_HOME: join(root, "cache"), PI_CODING_AGENT_DIR: join(root, "agent"), ZMX_DIR: join(root, "zmx"),
		PARALLEL_HOME: join(root, "parallel"), WORKER_SLOTS: "1", MISE_TRUSTED_CONFIG_PATHS: root, PI_THREAD_RUNTIME: "zmx",
		TRACKER_CLI: join(import.meta.dir, "../../../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"), PI_AGENTS_DIR: join(import.meta.dir, "../../../agents"),
		PATH: join(root, "bin") + ":" + process.env.PATH,
		WORKER_PRESSURE_PROBE: "bun -e " + quote("process.stdout.write(require('fs').readFileSync(process.argv[1], 'utf8'))") + " " + quote(join(root, "pressure.json")),
	});
}

async function ready(handle: string, state: "running" | "memory" | "slots") {
	for (let i = 0; i < 300; i++) {
		const t = (await allThreads()).find(t => t.worker?.handle === handle);
		const admission = t && readAdmission(t.id);
		if (t && admission && (state === "running" ? admission.state === "running" && existsSync(join(t.cwd, "setup-marker"))
			: state === "memory" ? admission.reason?.startsWith("memory free") : admission.reason === "worker slots")) return;
		await Bun.sleep(200);
	}
	throw new Error("Fixture readiness timed out for " + handle + " (" + state + "); use the printed cleanup command.");
}

async function observe(root: string) {
	const rows = await listThreads();
	for (const r of rows) console.log(JSON.stringify({
		owner: r.thread.worker?.run, worker: r.thread.worker?.handle, thread: r.thread.id,
		state: r.state, admission: r.admission, workspace: r.workspace,
		setupPrepared: existsSync(join(r.thread.cwd, "setup-marker")),
	}));
	for (const owner of ["owner-a", "owner-b"]) {
		console.log(JSON.stringify({ statusOwner: owner, reconcileStatus: campaigns(join(root, owner)).map(summary) }));
	}
	return rows;
}

const [action, arg, owner, handle] = process.argv.slice(2);
if (action === "prepare") {
	if (arg !== "capacity" && arg !== "pressure") throw new Error("prepare capacity|pressure");
	const root = realpathSync(mkdtempSync("/tmp/worker-budget-"));
	writeFileSync(join(root, "fixture.json"), JSON.stringify({ mode: arg }));
	writeFileSync(join(root, "pressure.json"), JSON.stringify({ freePercent: arg === "pressure" ? 1 : 80, swapMB: 0 }));
	mkdirSync(join(root, "bin"));
	writeFileSync(join(root, "bin", "pi"), "#!/bin/sh\necho READY\nexec sleep 300\n");
	chmodSync(join(root, "bin", "pi"), 0o755);
	environment(root);
	console.log("Owned fixture: " + root);
	console.log("inspect: bun " + import.meta.path + " inspect " + root);
	console.log("release capacity: bun " + import.meta.path + " retire " + root + " first");
	console.log("release pressure: bun " + import.meta.path + " low " + root);
	console.log("cleanup: bun " + import.meta.path + " cleanup " + root);
	for (const name of ["owner-a", "owner-b"]) {
		const repo = join(root, name); mkdirSync(repo);
		await command("git", ["init", "-b", "main"], repo);
		await command("git", ["config", "user.name", "Fixture"], repo);
		await command("git", ["config", "user.email", "fixture@example.invalid"], repo);
		writeFileSync(join(repo, ".gitignore"), "setup-marker\n");
		writeFileSync(join(repo, "mise.toml"), '[tasks.setup]\nrun = "echo prepared >> setup-marker"\n');
		await command("git", ["add", "."], repo);
		await command("git", ["commit", "-m", "fixture"], repo);
	}
	// Separate processes and repositories, not two launches in the same owner.
	console.log(await command("bun", [import.meta.path, "launch", root, "owner-a", "first"]));
	await ready("first", arg === "capacity" ? "running" : "memory");
	if (arg === "capacity") {
		console.log(await command("bun", [import.meta.path, "launch", root, "owner-b", "second"]));
		await ready("second", "slots");
	}
	await observe(root);
} else {
	environment(arg!);
	if (action === "threads") await threadCLI(["ls"]);
	else if (action === "launch") {
		const cwd = join(arg!, owner!);
		const receipt = await dispatch([{ handle: handle!, prompt: "Shell fixture", model: "fixture/shell", effort: "low" }], { cwd, run: owner!, parent: "fixture-" + owner, maxConcurrent: 1, active: [] });
		if (receipt.failed) throw new Error(receipt.failed.error);
		const worker = receipt.submitted[0]!;
		// A paused cache exercises the actual reconcile_status projection; no autonomous reconciler runs.
		saveState({ backend: "threads", root: "worker-budget-fixture", cwd, owner: "mail/fixture", budget: 1,
			landed: {}, results: {}, landingOps: {}, refinements: {}, collectors: {}, chains: { [handle!]: { into: cwd, self: false, phase: "implement", handle: worker, workers: [], retries: {} } },
			exceptions: {}, tests: {}, resolved: {}, moved: {}, counter: 0, log: [] });
		console.log(JSON.stringify(receipt));
	} else if (action === "inspect") await observe(arg!);
	else if (action === "low") {
		writeFileSync(join(arg!, "pressure.json"), JSON.stringify({ freePercent: 80, swapMB: 0 }));
		console.log("Probe now reports low pressure; inspect after the next 2-second probe.");
	} else if (action === "retire") {
		const t = (await allThreads()).find(t => t.worker?.handle === owner);
		if (!t) throw new Error("No fixture worker: " + owner);
		console.log(JSON.stringify(await abandonThread(t.id)));
	} else if (action === "cleanup") {
		for (const t of await allThreads()) console.log(JSON.stringify(await abandonThread(t.id)));
		rmSync(arg!, { recursive: true, force: true });
	} else throw new Error("prepare capacity|pressure | inspect|threads|low|retire|cleanup ROOT [HANDLE]");
}
