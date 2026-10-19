import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fakeBb, threads } from "../thread/fake-bb";
import { merge, spawn, type Worker } from "../wm";
import { getTracker } from "../tracker";
import { refreshWorker } from "./refresh";
import { git as reconcilerGit } from "./checks";

// The ticket authorizes this output/argument regression: large git output must not abort a successor.
test("successor merge suppresses diffstat and reconciler git accepts output above 1 MiB", () => {
	const repo = realpathSync(mkdtempSync("/tmp/rc-output-"));
	const trace = join(repo, "merge.trace");
	const savedTrace = process.env.GIT_TRACE;
	try {
		reconcilerGit(repo, "init", "-qb", "main");
		reconcilerGit(repo, "config", "user.name", "Fixture");
		reconcilerGit(repo, "config", "user.email", "fixture@example.invalid");
		reconcilerGit(repo, "commit", "--allow-empty", "-qm", "seed");
		const successor = join(repo, "successor");
		reconcilerGit(repo, "worktree", "add", "-b", "successor", successor);
		const content = "x".repeat(2 * 1024 * 1024);
		writeFileSync(join(repo, "large.txt"), content);
		reconcilerGit(repo, "add", "large.txt");
		reconcilerGit(repo, "commit", "-qm", "collector");
		// Override repository defaults: the automatic merge must suppress its own summary.
		reconcilerGit(repo, "config", "merge.stat", "true");
		process.env.GIT_TRACE = trace;
		const refreshed = refreshWorker(successor, repo);
		expect(refreshed.conflicts).toEqual([]);
		expect(readFileSync(trace, "utf8")).toContain("merge --no-edit --no-verify --no-stat");
		expect(reconcilerGit(successor, "show", "HEAD:large.txt")).toBe(content);
	} finally {
		if (savedTrace === undefined) delete process.env.GIT_TRACE;
		else process.env.GIT_TRACE = savedTrace;
		rmSync(repo, { recursive: true, force: true });
	}
});

// Workers on a fake bb CLI exercise the real checkout/setup/launch seam; no daemon, model or paid API.
test("an integrated handler ruling reaches a successor before setup and launch, keeping predecessor work", async () => {
	const root = realpathSync(mkdtempSync("/tmp/rc-test-")), repo = join(root, "repo");
	const saved = { ...process.env }, workers: Worker[] = [];
	const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
	const ticket = "docs/issues/measure.md", ruling = "Done: offline packet audit; no paid inference\nStories: measurement claims\n";
	const cli = realpathSync(join(import.meta.dir, "../../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"));
	const trackerModule = realpathSync(join(import.meta.dir, "../tracker.ts"));
	const commit = (cwd: string, file: string, content: string) => {
		writeFileSync(join(cwd, file), content);
		git(cwd, "add", file); git(cwd, "commit", "-qm", file);
		return git(cwd, "rev-parse", "HEAD");
	};
	try {
		for (const key of Object.keys(process.env)) if (/^(?:PI_WM_.*|PI_BOARD_.*|PI_SESSION_.*|AB_THREAD_ID|BB_.*|TMUX.*|WORKER_.*)$/.test(key)) delete process.env[key];
		Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"), PI_CODING_AGENT_DIR: join(root, "agent"), MISE_TRUSTED_CONFIG_PATHS: root, TRACKER_CLI: cli, PI_AGENTS_DIR: realpathSync(join(import.meta.dir, "../../agents")) });
		fakeBb(root);
		mkdirSync(repo); git(repo, "init", "-qb", "main");
		git(repo, "config", "user.name", "Fixture"); git(repo, "config", "user.email", "fixture@example.invalid");
		mkdirSync(join(repo, "docs/issues"), { recursive: true });
		commit(repo, ticket, "---\nstage: ticket\nassignee: agent\n---\n\nDone: live drive\nStories: product success\n");
		commit(repo, ".gitignore", "setup-contract\n");
		commit(repo, "setup.ts", 'import { writeFileSync } from "node:fs"; import { getTracker } from ' + JSON.stringify(trackerModule) + '; writeFileSync("setup-contract", getTracker(process.cwd()).text("measure"));\n');
		commit(repo, "mise.toml", '[tasks.setup]\nrun = "bun setup.ts"\n');
		const fixture = async (handle: string, base?: string, prepare?: (cwd: string) => Promise<string | void>) => {
			const worker = await spawn({ cwd: repo, run: "fixture", handle, base, prepare, prompt: "old contract", model: "fake/model", effort: "low" });
			workers.push(worker);
			return worker;
		};
		const previous = await fixture("previous");
		const previousHead = commit(previous.dir, "result.txt", "retained packet\n");
		const handler = await fixture("handler");
		getTracker(handler.dir, { inflight: false }).update("measure", { drive: "none" }, ruling);
		commit(handler.dir, "handler-artifact.txt", "offline ruling artifact\n");
		await merge(handler);
		const decision = git(repo, "rev-parse", "HEAD");
		const successor = await fixture("successor", previousHead, async cwd => {
			refreshWorker(cwd, repo);
			return getTracker(cwd, { inflight: false }).text("measure");
		});
		expect(git(successor.dir, "merge-base", "--is-ancestor", decision, "HEAD")).toBe("");
		expect(git(successor.dir, "merge-base", "--is-ancestor", previousHead, "HEAD")).toBe("");
		expect(readFileSync(join(successor.dir, "result.txt"), "utf8")).toBe("retained packet\n");
		expect(readFileSync(join(successor.dir, "setup-contract"), "utf8")).toContain(ruling);
		const prompt = threads(join(root, "fake-bb")).find(t => t.id === successor.bb)?.prompt;
		expect(prompt).toContain(ruling.trim()); // bb gets the prompt trimmed
		expect(prompt).not.toContain("old contract");
		expect(git(repo, "config", "branch.successor.ab-parent")).toBe("main");
	} finally {
		try { await Promise.all(workers.map(worker => worker.close())); }
		finally { process.env = saved; rmSync(root, { recursive: true, force: true }); }
	}
}, 30_000);
