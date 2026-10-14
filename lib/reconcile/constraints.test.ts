import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { constrain, summary } from "./main";
import { constrainedPrompt, load, saveState, type State } from "./reconcile";
import { getThread } from "../thread/registry";
import { readFrom } from "../board/store";
import { spawn, type Worker } from "../wm";
import { fakeBb } from "../thread/fake-bb";

// Approved fake-bb smoke: an owner restriction outlives the running implement turn.
test("a mid-implement constraint reaches drive and review first prompts, not an unconstrained node", async () => {
	const root = realpathSync(mkdtempSync("/tmp/rc-constraint-")), repo = join(root, "repo");
	const saved = { ...process.env }, workers: Worker[] = [];
	const git = (...args: string[]) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
	try {
		for (const key of Object.keys(process.env)) if (/^(?:PI_WM_.*|PI_BOARD_.*|PI_SESSION_.*|AB_THREAD_ID|BB_.*|TMUX.*|WORKER_.*)$/.test(key)) delete process.env[key];
		Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"), PI_BOARD_DIR: join(root, "board"), PI_CODING_AGENT_DIR: join(root, "agent"), MISE_TRUSTED_CONFIG_PATHS: root,
			TRACKER_CLI: join(import.meta.dir, "../../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"), PI_AGENTS_DIR: join(import.meta.dir, "../../agents") });
		fakeBb(root);
		mkdirSync(repo); git("init", "-qb", "main");
		git("config", "user.name", "Fixture"); git("config", "user.email", "fixture@example.invalid");
		writeFileSync(join(repo, "README.md"), "Shell constraint fixture\n");
		git("add", "."); git("commit", "-qm", "fixture");
		const fixture = async (handle: string, node: string) => {
			const worker = await spawn({ cwd: repo, run: "fixture", handle, prompt: "Phase " + handle, model: "fake/model", effort: "low",
				prepare: async () => constrainedPrompt(repo, "fixture", node, "Phase " + handle) });
			workers.push(worker);
			return worker;
		};
		const implement = await fixture("implement", "live");
		const state: State = { backend: "threads", root: "fixture", cwd: repo, owner: "mail/fixture", budget: 1, pid: process.pid,
			landed: {}, results: {}, landingOps: {}, refinements: {}, collectors: {}, chains: { live: { into: repo, self: false, phase: "implement", retries: {}, workers: [],
				handle: { run: "fixture", handle: "implement", path: implement.dir, threadId: implement.threadId } } },
			exceptions: {}, tests: {}, resolved: {}, moved: {}, counter: 0, log: [] };
		saveState(state);
		const text = "The live vault is read-only; do not re-run prepare.";
		expect(constrain(repo, "fixture", "live", text)).toEqual({ recorded: true, mailed: true });
		expect(readFrom(0).messages.some(m => m.topic === "fixture/implement" && m.body.includes(text))).toBe(true);
		// The loop's older in-memory snapshot must not erase the owner's write.
		saveState(state);
		expect(summary({ ...load(repo, "fixture")!, running: true }).constraints.live).toEqual([text]);
		for (const phase of ["drive", "review"]) {
			const worker = await fixture(phase, "live");
			expect((await getThread(worker.threadId!))?.launch?.prompt).toContain(text);
		}
		const other = await fixture("other-drive", "other");
		expect((await getThread(other.threadId!))?.launch?.prompt).not.toContain(text);
		expect((await getThread(implement.threadId!))?.launch?.prompt).not.toContain(text);
	} finally {
		try { await Promise.all(workers.map(worker => worker.close())); }
		finally { process.env = saved; rmSync(root, { recursive: true, force: true }); }
	}
}, 30_000);
