// Disposable fake-bb worker setup for trying reconcile stop through the CLI. No daemon, model or credentials.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { campaigns, start, stop, summary } from "../../../lib/reconcile/main";
import { load, saveState, type State } from "../../../lib/reconcile/reconcile";
import { allThreads } from "../../../lib/thread/registry";
import { abandonThread } from "../../../lib/thread/lifecycle";
import { fakeBb, threads } from "../../../lib/thread/fake-bb";
import { readFrom } from "../../../lib/board/store";
import { pidAlive, spawn } from "../../../lib/wm";
import type { Handle } from "../../../lib/dispatch";

const packagePath = fileURLToPath(new URL("../../../", import.meta.url));
export type Fixture = { root: string; cwd: string; collector: string; env: Record<string, string>;
	pid: number; leftoverPid: number; workers: { receipt: Handle; branch: string }[] };
export const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
const selectors = (root: string) => ({ XDG_STATE_HOME: join(root, "state"), PI_BOARD_DIR: join(root, "board"),
	PI_CODING_AGENT_DIR: join(root, "agent"), MISE_TRUSTED_CONFIG_PATHS: root, BB_CLI: join(root, "fake-bb/bb"), FAKE_BB_DIR: join(root, "fake-bb"),
	TRACKER_CLI: join(packagePath, "skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"), PI_AGENTS_DIR: join(packagePath, "agents") });
export function use(env: Record<string, string>) {
	for (const key of Object.keys(process.env)) if (/^(?:PI_WM_.*|PI_BOARD_.*|PI_SESSION_.*|AB_THREAD_ID|BB_.*|FAKE_BB_.*|TMUX.*|WORKER_.*)$/.test(key)) delete process.env[key];
	Object.assign(process.env, env);
}
export async function prepare(): Promise<Fixture> {
	const root = realpathSync(mkdtempSync("/tmp/rc-stop-")), cwd = join(root, "repo"), collector = join(root, "repo__worktrees/fixture--tree");
	const env = selectors(root);
	use(env);
	fakeBb(root); // writes the BB_CLI that env names
	mkdirSync(cwd); git(cwd, "init", "-qb", "main");
	git(cwd, "config", "user.name", "Fixture"); git(cwd, "config", "user.email", "fixture@example.invalid");
	mkdirSync(join(cwd, "docs/issues"), { recursive: true });
	writeFileSync(join(cwd, "docs/issues/fixture.md"), "---\nstage: ticket\nassignee: agent\n---\n\nStop fixture.\n");
	git(cwd, "add", "."); git(cwd, "commit", "-qm", "fixture");
	git(cwd, "worktree", "add", "-qb", "tree/fixture", collector);
	git(cwd, "config", "branch.tree/fixture.ab-parent", "main");
	const f: Fixture = { root, cwd, collector, env, pid: 0, leftoverPid: 0, workers: [] };
	// Save selectors before launches, so cleanup can recover a partially prepared fixture.
	const save = () => writeFileSync(join(root, "fixture.json"), JSON.stringify(f, null, 2));
	save();
	try {
		for (const handle of ["implement", "handler", "launch-race"]) {
			const w = await spawn({ cwd: handle === "handler" ? collector : cwd, run: "fixture", handle, prompt: "Stop fixture", model: "fake/model", effort: "low" });
			f.workers.push({ receipt: { run: w.run, handle: w.handle, path: w.dir, threadId: w.threadId }, branch: w.branch }); save();
			writeFileSync(join(w.dir, handle + ".txt"), "unmerged " + handle + "\n");
			git(w.dir, "add", "."); git(w.dir, "commit", "-qm", handle);
		}
		const [implement, handler] = f.workers.map(w => w.receipt);
		const leftover = Bun.spawn(["sleep", "600"], { cwd: implement.path, stdio: ["ignore", "ignore", "ignore"] });
		leftover.unref(); f.leftoverPid = leftover.pid; save();
		const state: State = { backend: "threads", root: "fixture", cwd, owner: "mail/fixture", budget: 3,
			landed: {}, results: {}, landingOps: {}, refinements: {}, collectors: { fixture: { path: collector, branch: "tree/fixture", parentBranch: "main" } },
			chains: { fixture: { into: cwd, self: false, phase: "implement", retries: {}, workers: [implement],
				handle: implement, launchedAt: Date.now() } },
			exceptions: { fixture: { id: "fixture", node: "fixture", reason: "fixture", text: "", at: new Date().toISOString(),
				level: "fixture", handler, handlerLaunchedAt: Date.now() } },
			tests: {}, resolved: {}, moved: {}, counter: 3, log: [] };
		saveState(state);
		f.pid = start({ cwd, root: "fixture", owner: state.owner, budget: 3 }).pid; save();
		for (let i = 0; i < 100; i++) {
			if (readFrom(0).messages.some(m => m.body.includes("[reconcile fixture] started")) && load(cwd, "fixture")?.pid === f.pid) return f;
			if (!pidAlive(f.pid)) throw new Error("fixture reconciler exited before readiness");
			await Bun.sleep(100);
		}
		throw new Error("fixture reconciler readiness timeout");
	} catch (error) { await cleanup(f); throw error; }
}
export async function cleanup(f: Fixture) {
	use(f.env);
	if (load(f.cwd, "fixture")) await stop(f.cwd, "fixture");
	for (const t of await allThreads()) await abandonThread(t.id, { keepBranch: true });
	process.chdir(packagePath);
	rmSync(f.root, { recursive: true, force: true });
}
if (import.meta.main) {
	const [action = "help", target] = process.argv.slice(2);
	if (action === "prepare") {
		const f = await prepare();
		console.log(JSON.stringify({ ...f, readiness: "running reconciler, live shell workers and handler; unmerged commits and collector prepared",
			entrypoint: "bun " + import.meta.path + " stop " + f.root }, null, 2));
	} else if (["stop", "inspect", "cleanup"].includes(action)) {
		if (!target) throw new Error("Expected owned fixture root");
		const root = realpathSync(resolve(target));
		const f: Fixture = JSON.parse(readFileSync(join(root, "fixture.json"), "utf8"));
		if (!/^\/(?:private\/)?tmp\/rc-stop-/.test(root) || f.root !== root || JSON.stringify(f.env) !== JSON.stringify(selectors(root)) || f.cwd !== join(root, "repo"))
			throw new Error("Selectors do not address an owned stop fixture");
		use(f.env);
		if (action === "stop") {
			const child = Bun.spawn(["bun", join(packagePath, "lib/reconcile/main.ts"), "stop", "fixture", "--cwd", f.cwd],
				{ cwd: packagePath, env: process.env, stdio: ["ignore", "inherit", "inherit"] });
			process.exitCode = await child.exited;
		} else if (action === "inspect") console.log(JSON.stringify({
			state: campaigns(f.cwd).map(summary), threads: (await allThreads()).map(t => ({ id: t.id, worker: t.worker, cwd: t.cwd })), bbThreads: threads(join(f.root, "fake-bb")).map(t => ({ id: t.id, environment: t.environment, archived: t.archivedAt !== null })),
			reconcilerAlive: pidAlive(f.pid), leftoverAlive: pidAlive(f.leftoverPid), collectorExists: existsSync(f.collector),
			worktrees: git(f.cwd, "worktree", "list", "--porcelain"), branches: git(f.cwd, "branch", "--list"),
		}, null, 2));
		else { await cleanup(f); console.log("Fixture removed"); }
	} else console.log("prepare | stop ROOT | inspect ROOT | cleanup ROOT\nDisposable local Git/thread state on a fake bb CLI, no auth or model. prepare prints a directly runnable stop entry.");
}
