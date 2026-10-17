import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fakeBb } from "../thread/fake-bb";
import { readFrom, send } from "../board/store";
import { start, stop } from "./main";
import { load, saveState } from "./reconcile";

// Real reconciler process and worker setup on a fake bb CLI: no model, daemon or credentials.
const packagePath = realpathSync(join(import.meta.dir, "../.."));
async function until<T>(read: () => T | undefined | false, ms = 40_000): Promise<T> {
	for (let i = 0; i < ms / 100; i++) { const value = read(); if (value) return value; await Bun.sleep(100); }
	throw new Error("timed out");
}

test("a restarted node continues from its stopped worker's kept branch, and a replaced worker's uncommitted work is in its successor's base", async () => {
	const root = realpathSync(mkdtempSync("/tmp/rc-resume-")), saved = { ...process.env };
	const repo = join(root, "repo");
	const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
	let running = false;
	try {
		for (const key of Object.keys(process.env)) if (/^(?:PI_WM_.*|PI_BOARD_.*|PI_SESSION_.*|AB_THREAD_ID|BB_.*|FAKE_BB_.*|TMUX.*|WORKER_.*)$/.test(key)) delete process.env[key];
		Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"), PI_BOARD_DIR: join(root, "board"),
			PI_CODING_AGENT_DIR: join(root, "agent"), PI_AGENTS_DIR: join(root, "agents"), MISE_TRUSTED_CONFIG_PATHS: root,
			PI_RECONCILE_TICK_MS: "100", PI_RECONCILE_ERROR_SETTLE_MS: "0",
			TRACKER_CLI: join(packagePath, "skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts") });
		const bb = fakeBb(root);
		for (const dir of [repo, join(root, "agents/roles"), join(repo, "docs/issues")]) mkdirSync(dir, { recursive: true });
		writeFileSync(join(root, "agents/shell.md"), "---\nrole: implement\n---\nShell fixture.\n");
		writeFileSync(join(root, "agents/roles/implement.md"), "Shell fixture.\n");
		git(repo, "init", "-qb", "main"); git(repo, "config", "user.name", "Fixture"); git(repo, "config", "user.email", "fixture@example.invalid");
		writeFileSync(join(repo, "docs/issues/solo.md"), "---\nstage: ticket\nassignee: agent:shell\n---\n\nResume fixture.\n");
		git(repo, "add", "."); git(repo, "commit", "-qm", "fixture");
		// What stop leaves: no chains, the retired implementer's branch with its work, and a resume record for it.
		git(repo, "branch", "solo-implement-1");
		const scratch = join(root, "scratch");
		git(repo, "worktree", "add", "-q", scratch, "solo-implement-1");
		writeFileSync(join(scratch, "work.txt"), "earlier work\n"); git(scratch, "add", "."); git(scratch, "commit", "-qm", "earlier work");
		const kept = git(scratch, "rev-parse", "HEAD");
		git(repo, "worktree", "remove", "--force", scratch);
		saveState({ backend: "threads", root: "solo", cwd: repo, owner: "mail/solo", budget: 1, finished: "stopped",
			landed: {}, results: {}, landingOps: {}, refinements: {}, collectors: {}, chains: {}, exceptions: {}, tests: {}, resolved: {}, moved: {},
			counter: 1, log: [], resume: { solo: { phase: "implement", branch: "solo-implement-1", head: kept } } });

		start({ cwd: repo, root: "solo", owner: "mail/solo", budget: 1 });
		running = true;
		const started = (path: string) => bb.threads().some(t => t.environment === path);
		const first = await until(() => { const h = load(repo, "solo")?.chains.solo?.handle; return h && started(h.path) && h; });
		expect(git(first.path, "rev-parse", "HEAD")).toBe(kept);
		expect(load(repo, "solo")!.resume).toEqual({});

		// Two provider errors: the second replaces the worker, which left work uncommitted.
		writeFileSync(join(first.path, "draft.txt"), "uncommitted\n");
		bb.setStatus(first.path, "idle");
		send({ from: {}, topic: "solo/" + first.handle, tags: ["turn-end", "error"], body: "Codex error: An error occurred while processing your request" });
		await until(() => load(repo, "solo")?.chains.solo?.retries.provider === 1);
		send({ from: {}, topic: "solo/" + first.handle, tags: ["turn-end", "error"], body: "Codex error: An error occurred while processing your request" });
		const second = await until(() => { const h = load(repo, "solo")?.chains.solo?.handle; return h && h.handle !== first.handle && started(h.path) && h; });
		expect(readFileSync(join(second.path, "draft.txt"), "utf8")).toBe("uncommitted\n");
		expect(readFileSync(join(second.path, "work.txt"), "utf8")).toBe("earlier work\n");
		expect(git(second.path, "log", "-1", "--format=%s", "HEAD")).toStartWith("WIP: uncommitted work of solo/" + first.handle);
	} catch (error) {
		console.error(JSON.stringify({ state: load(repo, "solo"), board: readFrom(0).messages.map(m => m.topic + " " + m.body.slice(0, 200)) }, null, 1));
		throw error;
	} finally {
		if (running) await stop(repo, "solo");
		process.env = saved;
		rmSync(root, { recursive: true, force: true });
	}
}, 90_000);
