// Local first-use fixture: no model calls, credentials, live worker, or shared host state.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { run, saveState } from "../../../lib/reconcile/reconcile";
import { fakeBb } from "../../../lib/thread/fake-bb";

export async function rehearsal(mode: "conflict" | "deps" | "setup" | "unchanged") {
	const root = realpathSync(mkdtempSync("/tmp/rc-landing-")), cwd = join(root, "repo"), child = join(root, "child");
	const saved = { ...process.env };
	const git = (path: string, ...args: string[]) => execFileSync("git", ["-C", path, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
	const commit = (path: string, subject: string) => { git(path, "add", "."); git(path, "commit", "-qm", subject); };
	const controller = new AbortController();
	let timer: ReturnType<typeof setInterval> | undefined;
	try {
		for (const key of Object.keys(process.env)) if (/^(?:PI_WM_.*|PI_BOARD_.*|PI_SESSION_.*|AB_THREAD_ID|BB_.*|PI_THREAD_RUNTIME|ZMX_.*|TMUX.*)$/.test(key)) delete process.env[key];
		Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"),
			PI_CODING_AGENT_DIR: join(root, "agent"), ZMX_DIR: join(root, "zmx"), MISE_TRUSTED_CONFIG_PATHS: root, PI_THREAD_RUNTIME: "zmx",
			TRACKER_CLI: join(import.meta.dir, "../../../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"), PI_AGENTS_DIR: join(import.meta.dir, "../../../agents") });
		const bb = fakeBb(root);
		bb.addThread("thr_fixture-owner");
		bb.addThread("bbt-child", child, "fixture/child");
		const told = () => bb.threads().find(t => t.id === "bbt-child")!.tells.find(tell => tell.includes("Integration into"));
		mkdirSync(join(cwd, "docs/issues"), { recursive: true });
		git(cwd, "init", "-qb", "main");
		git(cwd, "config", "user.name", "Fixture"); git(cwd, "config", "user.email", "fixture@example.invalid");
		writeFileSync(join(cwd, "docs/issues/fixture.md"), "---\nstage: ticket\nassignee: agent\n---\n\nLanding fixture.\n");
		writeFileSync(join(cwd, ".gitignore"), "order\n");
		writeFileSync(join(cwd, "conflict.txt"), "base\n");
		writeFileSync(join(cwd, "bun.lock"), "base lock\n");
		writeFileSync(join(cwd, "mise.toml"), '[tasks.setup]\nrun = "echo setup >> ' + join(root, "order") + '"\n'
			+ (mode === "setup" ? "" : '[tasks.deps]\nrun = "echo deps >> ' + join(root, "order") + '"\n')
			+ '[tasks.pre-integrate]\nrun = "echo gate >> ' + join(root, "order") + '"\n');
		commit(cwd, "seed");
		git(cwd, "worktree", "add", "-qb", "child", child);
		git(cwd, "config", "branch.child.ab-parent", "main");
		writeFileSync(join(child, mode === "conflict" ? "conflict.txt" : "child.txt"), "child\n");
		commit(child, "Child change");
		const childBefore = git(child, "rev-parse", "HEAD");
		writeFileSync(join(cwd, mode === "conflict" ? "conflict.txt" : mode === "unchanged" ? "target.txt" : "bun.lock"), "target\n");
		commit(cwd, mode === "conflict" ? "Target conflict subject" : "Target dependency update");
		const targetBefore = git(cwd, "rev-parse", "HEAD");
		saveState({ backend: "threads", root: "fixture", cwd, owner: "thr_fixture-owner", budget: 1,
			landed: {}, results: {}, landingOps: {}, refinements: {}, collectors: {}, chains: { fixture: { into: cwd, self: true, phase: "review", retries: {}, workers: [],
				handle: { run: "fixture", handle: "child", path: child, bb: "bbt-child" } } },
			exceptions: {}, tests: {}, resolved: {}, moved: {}, counter: 0, log: [] });
		bb.completeTurn(child, 'done\n\n' + "\x60\x60\x60json\n"
			+ JSON.stringify({ stories: [{ story: "Landing fixture", outcome: "held" }] }) + "\n\x60\x60\x60");
		const deadline = Date.now() + 20_000;
		timer = setInterval(() => {
			if (told()
				|| /^stage: done$/m.test(readFileSync(join(cwd, "docs/issues/fixture.md"), "utf8")) || Date.now() > deadline) controller.abort();
		}, 50);
		await run({ cwd, root: "fixture", owner: "thr_fixture-owner", budget: 1, signal: controller.signal });
		return {
			message: told(),
			targetBefore, targetAfter: git(cwd, "rev-parse", "HEAD"), childBefore,
			childAfter: (() => { try { return git(cwd, "rev-parse", "child"); } catch { return null; } })(),
			order: (() => { try { return readFileSync(join(root, "order"), "utf8").trim().split("\n"); } catch { return []; } })(),
			done: /^stage: done$/m.test(readFileSync(join(cwd, "docs/issues/fixture.md"), "utf8")),
		};
	} finally {
		if (timer) clearInterval(timer);
		controller.abort();
		process.env = saved;
		rmSync(root, { recursive: true, force: true });
	}
}

if (import.meta.main) {
	const mode = process.argv[2] ?? "conflict";
	if (!["conflict", "deps", "setup", "unchanged"].includes(mode)) throw new Error("Use conflict, deps, setup or unchanged");
	console.log("RESULT " + JSON.stringify(await rehearsal(mode as Parameters<typeof rehearsal>[0])));
}
