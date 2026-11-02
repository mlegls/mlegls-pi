// Disposable first-use setup, using the existing fake-bb runtime: no model, daemon or credentials.
// bun docs/attachments/long-running-reconcilers-keep-pre-change-code/setup.ts [status|stop <fixture-root>]
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fakeBb } from "../../../lib/thread/fake-bb";

const source = resolve(import.meta.dir, "../../..");
const [action, target] = process.argv.slice(2);
if (action) {
	if (!["status", "stop"].includes(action) || !target?.startsWith("/tmp/code-refresh-") || !existsSync(join(target, "fixture.json")))
		throw new Error("usage: setup.ts [status|stop /tmp/code-refresh-...]");
	const { code, cwd, env } = JSON.parse(readFileSync(join(target, "fixture.json"), "utf8"));
	const call = (file: string, ...args: string[]) => execFileSync(process.execPath,
		[join(code, "lib/reconcile", file + ".ts"), ...args, "--cwd", cwd], { env, encoding: "utf8" });
	if (action === "status") console.log(call("main", "status"), call("pickup", "status"));
	else {
		console.log(call("pickup", "stop"));
		console.log(call("main", "stop", "solo"));
		rmSync(target, { recursive: true, force: true });
	}
} else {
	const root = realpathSync(mkdtempSync("/tmp/code-refresh-")), code = join(root, "package"), cwd = join(root, "repo");
	// A real source copy, not a symlink: the driver can edit it without changing another run's package.
	for (const dir of ["lib", "extensions/supervision"]) cpSync(join(source, dir), join(code, dir), { recursive: true });
	for (const dir of ["node_modules", "skills"]) symlinkSync(join(source, dir), join(code, dir));
	writeFileSync(join(code, "package.json"), '{"type":"module"}\n');
	for (const dir of [join(cwd, "docs/issues"), join(root, "agents/roles")]) mkdirSync(dir, { recursive: true });
	writeFileSync(join(root, "agents/shell.md"), "---\nrole: implement\n---\nShell fixture.\n");
	writeFileSync(join(root, "agents/roles/implement.md"), "Shell fixture.\n");
	writeFileSync(join(cwd, "docs/issues/solo.md"), "---\nstage: ticket\nassignee: agent:shell\n---\nCode refresh fixture.\n");
	const git = (...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: "pipe" });
	git("init", "-qb", "main");
	git("config", "user.name", "Fixture"); git("config", "user.email", "fixture@example.invalid");
	git("add", "."); git("commit", "-qm", "fixture");
	const bb = fakeBb(root); bb.addThread("thr_fixture");
	const env = {
		PATH: process.env.PATH!, HOME: process.env.HOME!, BB_CLI: process.env.BB_CLI!, FAKE_BB_DIR: bb.dir,
		XDG_STATE_HOME: join(root, "state"), XDG_CACHE_HOME: join(root, "cache"),
		PI_CODING_AGENT_DIR: join(root, "agent"), PI_AGENTS_DIR: join(root, "agents"),
		MISE_TRUSTED_CONFIG_PATHS: root, PI_RECONCILE_TICK_MS: "100",
		TRACKER_CLI: realpathSync(join(source, "skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts")),
	};
	const fixture = { root, code, cwd, env };
	writeFileSync(join(root, "fixture.json"), JSON.stringify(fixture, null, 2));
	execFileSync(process.execPath, [join(code, "lib/reconcile/main.ts"), "start", "solo",
		"--owner", "thr_fixture", "--budget", "1", "--cwd", cwd], { env });
	execFileSync(process.execPath, ["-e", "import {configure} from " + JSON.stringify(join(code, "lib/reconcile/pickup.ts")) +
		"; await configure(" + JSON.stringify({ cwd, owner: "thr_fixture", scope: "project", paused: true }) + ")"], { env });
	let ready = false;
	for (let i = 0; i < 400; i++) {
		const state = join(cwd, ".git/reconcile/solo.json"), pickup = join(cwd, ".git/pickup/state.json");
		if (existsSync(state) && JSON.parse(readFileSync(state, "utf8")).chains.solo?.handle &&
			existsSync(pickup) && JSON.parse(readFileSync(pickup, "utf8")).codeVersion) { ready = true; break; }
		await Bun.sleep(100);
	}
	if (!ready) throw new Error("fixture not ready; inspect " + root + " and stop through setup.ts stop");
	console.log(JSON.stringify({ root, code, cwd, ready, entry: "bun " + import.meta.path + " status " + root }, null, 2));
}
