// Disposable first-use setup: real Git, desk, watcher and reconciler; fake bb runs no model.
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fakeBb } from "../../../lib/thread/fake-bb";
import { command } from "../../../lib/thread/process";
import { getTracker } from "../../../lib/tracker";
import { dispatch } from "../../../lib/dispatch";
import { addAttention, setRole, setWorking } from "../../../lib/desk";
import { configure, stopPickup } from "../../../lib/reconcile/pickup";
import { load, saveState } from "../../../lib/reconcile/reconcile";
import { start, stop } from "../../../lib/reconcile/main";

const source = resolve(import.meta.dir, "../../..");
const rootSlug = "question";
const [mode, fixture, ...args] = process.argv.slice(2);
const cleanIdentity = () => {
	for (const key of Object.keys(process.env))
		if (/^(?:PI_.*|BB_.*|AB_.*|TMUX.*|WORKER_.*|GIT_.*|TRACKER_.*)$/.test(key)) delete process.env[key];
};
const run = async (file: string, argv: string[]) => console.log(await command("bun", [join(source, file), ...argv]));

if (!mode || mode === "start") {
	const root = realpathSync(mkdtempSync("/tmp/supervisor-handover-")), cwd = join(root, "repo");
	cleanIdentity();
	const env: Record<string, string> = {
		XDG_STATE_HOME: join(root, "state"), XDG_CACHE_HOME: join(root, "cache"),
		PI_CODING_AGENT_DIR: join(root, "agent"), PI_AGENTS_DIR: join(root, "agents"),
		TRACKER_CLI: join(source, "skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"),
		MISE_TRUSTED_CONFIG_PATHS: root, PI_RECONCILE_TICK_MS: "100",
		BB_THREAD_ID: "thr_old",
	};
	Object.assign(process.env, env);
	mkdirSync(join(root, "agents/roles"), { recursive: true });
	writeFileSync(join(root, "agents/scratch.md"), "---\nname: scratch\nmodel: fake/model:low\nrole: implement\n---\nScratch worker.\n");
	writeFileSync(join(root, "agents/roles/implement.md"), "Scratch implement role; no model is run by the fake CLI.\n");
	const bb = fakeBb(root);
	Object.assign(env, { BB_CLI: process.env.BB_CLI!, FAKE_BB_DIR: bb.dir });
	mkdirSync(join(cwd, "docs/issues"), { recursive: true });
	const git = (...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: "pipe" });
	git("init", "-qb", "main");
	git("config", "user.name", "Scratch"); git("config", "user.email", "scratch@example.invalid");
	writeFileSync(join(cwd, "README.md"), "Disposable supervisor handover scratch.\n");
	git("add", "README.md"); git("commit", "-qm", "scratch");
	getTracker(cwd).create({ slug: rootSlug, fields: { stage: "ticket", assignee: "agent", author: "user:scratch" }, body: "Choose the fixture option.\n" });
	bb.addThread("thr_old"); bb.addThread("thr_new");
	const wave = await dispatch([{ handle: "question-implement-1", prompt: "Choose the fixture option.", model: "fake/model", effort: "low" }],
		{ cwd, run: rootSlug, active: [], maxConcurrent: 1, parentThread: "thr_old" });
	if (!wave.submitted[0]) throw new Error(JSON.stringify(wave));
	const worker = wave.submitted[0];
	bb.completeTurn(worker.path, "needs-input\n\nWhich option should I use?");
	const reportTs = new Date(Date.now() + 1000).toISOString();
	saveState({ backend: "threads", root: rootSlug, cwd, owner: "thr_old", budget: 0,
		landed: {}, results: {}, landingOps: {}, refinements: {}, collectors: {},
		chains: { question: { into: cwd, self: false, phase: "implement", retries: {}, workers: [], held: true,
			handle: worker, handledTs: reportTs, launchedAt: Date.now() - 5000 } },
		exceptions: { question: { id: "scratch-needs-input", node: rootSlug, reason: "implement needs-input",
			text: "needs-input\n\nWhich option should I use?", at: reportTs, reportTs, level: "owner", mailed: true } },
		tests: {}, resolved: {}, moved: {}, counter: 1, log: [] });
	await setRole("supervisor", "thr_old", cwd);
	await setWorking("thr_old", "Supervising the scratch question", cwd);
	await addAttention("thr_old", "Choose a fixture option", "Which option should the worker use?", cwd);
	const reconciler = start({ cwd, root: rootSlug, owner: "thr_old", budget: 0, quiet: true });
	await configure({ cwd, owner: "thr_old", scope: [rootSlug], paused: true });
	for (const deadline = Date.now() + 20_000; !load(cwd, rootSlug)?.ownerHandover;) {
		if (Date.now() > deadline) throw new Error("Scratch reconciler did not become ready; root " + root + ", pid " + reconciler.pid);
		await Bun.sleep(100);
	}
	writeFileSync(join(root, "fixture.json"), JSON.stringify({ root, cwd, env }));
	const use = join(root, "use");
	writeFileSync(use, "#!/bin/sh\nexec bun " + JSON.stringify(import.meta.path) + " use " + JSON.stringify(root) + ' "$@"\n');
	chmodSync(use, 0o755);
	console.log(JSON.stringify({ root, cwd, bb: "fake CLI; no daemon, models or credentials", reconciler: reconciler.pid,
		worker: worker.bb, entry: use + " desk handover thr_old thr_new",
		status: use + " status", resolve: use + ' resolve \'{"action":"answer","message":"Use option A"}\'',
		dispatch: use + " dispatch later", cleanup: use + " cleanup" }, null, 2));
} else if (mode === "use" && fixture) {
	const { cwd, env } = JSON.parse(readFileSync(join(fixture, "fixture.json"), "utf8"));
	cleanIdentity();
	Object.assign(process.env, env, { BB_THREAD_ID: "thr_new" });
	process.chdir(cwd);
	const [cmd, ...rest] = args;
	if (cmd === "desk") await run("lib/desk.ts", rest);
	else if (cmd === "status") await run("lib/reconcile/main.ts", ["status"]);
	else if (cmd === "pickup") await run("lib/reconcile/pickup.ts", rest.length ? rest : ["status"]);
	else if (cmd === "bb") console.log(await command(process.env.BB_CLI!, ["thread", ...rest, "--json"]));
	else if (cmd === "resolve") await run("lib/reconcile/main.ts", ["resolve", rootSlug, rootSlug, rest[0]!]);
	else if (cmd === "dispatch") {
		const active = Object.values(load(cwd, rootSlug)!.chains).flatMap(c => c.handle ? [c.handle] : []);
		console.log(JSON.stringify(await dispatch([{ handle: rest[0]!, prompt: "Later scratch worker.", model: "fake/model", effort: "low" }],
			{ cwd, run: rootSlug, active, maxConcurrent: active.length + 1 }), null, 2));
	}
	else if (cmd === "cleanup") {
		stopPickup(cwd);
		await stop(cwd, rootSlug);
		process.chdir("/tmp");
		rmSync(fixture, { recursive: true, force: true });
		console.log("Removed " + fixture);
	} else throw new Error("use: desk ... | status | pickup | bb ... | resolve JSON | dispatch HANDLE | cleanup");
} else throw new Error("scratch.ts start | use ROOT COMMAND");
