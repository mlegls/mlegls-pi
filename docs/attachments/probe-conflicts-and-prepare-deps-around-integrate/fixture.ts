// Local first-use fixture: no model calls, credentials, live worker, or shared host state.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { run, saveState } from "../../../lib/reconcile/reconcile";
import { saveThread } from "../../../lib/thread/registry";
import { readFrom, send } from "../../../lib/board/store";

export async function rehearsal(mode: "conflict" | "deps" | "setup" | "unchanged") {
	const root = realpathSync(mkdtempSync("/tmp/rc-landing-")), cwd = join(root, "repo"), child = join(root, "child");
	const saved = { ...process.env };
	const git = (path: string, ...args: string[]) => execFileSync("git", ["-C", path, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
	const commit = (path: string, subject: string) => { git(path, "add", "."); git(path, "commit", "-qm", subject); };
	const controller = new AbortController();
	let timer: ReturnType<typeof setInterval> | undefined;
	try {
		for (const key of Object.keys(process.env)) if (/^(?:PI_WM_.*|PI_BOARD_.*|PI_SESSION_.*|AB_THREAD_ID|BB_.*|PI_THREAD_RUNTIME|ZMX_.*|TMUX.*)$/.test(key)) delete process.env[key];
		Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"), PI_BOARD_DIR: join(root, "board"),
			PI_CODING_AGENT_DIR: join(root, "agent"), ZMX_DIR: join(root, "zmx"), MISE_TRUSTED_CONFIG_PATHS: root, PI_THREAD_RUNTIME: "zmx",
			TRACKER_CLI: join(import.meta.dir, "../../../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"), PI_AGENTS_DIR: join(import.meta.dir, "../../../agents") });
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
		await saveThread({ id: "fixture-child", sessionId: "fixture-child", sessionFile: join(root, "child.jsonl"),
			cwd: child, project: cwd, worktree: child, ownership: "owner", branch: "child", archived: false,
			created: new Date().toISOString(), worker: { run: "fixture", handle: "child" } });
		saveState({ backend: "threads", root: "fixture", cwd, owner: "mail/fixture-owner", budget: 1,
			landed: {}, results: {}, landingOps: {}, refinements: {}, collectors: {}, chains: { fixture: { into: cwd, self: true, phase: "review", retries: {}, workers: [],
				handle: { run: "fixture", handle: "child", path: child, threadId: "fixture-child" } } },
			exceptions: {}, tests: {}, resolved: {}, moved: {}, counter: 0, log: [] });
		send({ topic: "fixture/child", tags: ["done"], from: {}, body: 'done\n\n' + "\x60\x60\x60json\n"
			+ JSON.stringify({ stories: [{ story: "Landing fixture", outcome: "held" }] }) + "\n\x60\x60\x60" });
		const deadline = Date.now() + 20_000;
		timer = setInterval(() => {
			const messages = readFrom(0).messages;
			if (messages.some(m => m.topic === "fixture/child" && m.body.includes("Integration into"))
				|| /^stage: done$/m.test(readFileSync(join(cwd, "docs/issues/fixture.md"), "utf8")) || Date.now() > deadline) controller.abort();
		}, 50);
		await run({ cwd, root: "fixture", owner: "mail/fixture-owner", budget: 1, signal: controller.signal });
		const messages = readFrom(0).messages;
		return {
			message: messages.find(m => m.topic === "fixture/child" && m.body.includes("Integration into"))?.body,
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
