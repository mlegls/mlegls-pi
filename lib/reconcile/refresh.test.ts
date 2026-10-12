import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getThread } from "../thread/registry";
import { merge, spawn, type Worker } from "../wm";
import { refreshWorker } from "./refresh";

// Local shell workers exercise the real checkout/setup/launch seam; no model or paid API.
test("an integrated handler ruling reaches a successor before setup and launch, keeping predecessor work", async () => {
	const root = realpathSync(mkdtempSync("/tmp/rc-test-")), repo = join(root, "repo");
	const saved = { ...process.env }, workers: Worker[] = [];
	const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
	const ticket = "docs/issues/measure.md", ruling = "Done: offline packet audit; no paid inference\nStories: measurement claims\n";
	const commit = (cwd: string, file: string, content: string) => {
		writeFileSync(join(cwd, file), content);
		git(cwd, "add", file); git(cwd, "commit", "-qm", file);
		return git(cwd, "rev-parse", "HEAD");
	};
	try {
		for (const key of Object.keys(process.env)) if (/^(?:PI_WM_.*|PI_BOARD_.*|PI_SESSION_.*|AB_THREAD_ID|BB_THREAD_ID|PI_THREAD_RUNTIME|ZMX_.*|TMUX.*)$/.test(key)) delete process.env[key];
		Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"), PI_BOARD_DIR: join(root, "board"), PI_CODING_AGENT_DIR: join(root, "agent"), ZMX_DIR: join(root, "zmx"), MISE_TRUSTED_CONFIG_PATHS: root });
		mkdirSync(repo); git(repo, "init", "-qb", "main");
		git(repo, "config", "user.name", "Fixture"); git(repo, "config", "user.email", "fixture@example.invalid");
		mkdirSync(join(repo, "docs/issues"), { recursive: true });
		commit(repo, ticket, "Done: live drive\nStories: product success\n");
		commit(repo, ".gitignore", "setup-contract\n");
		commit(repo, "setup.ts", 'import { readFileSync, writeFileSync } from "node:fs"; writeFileSync("setup-contract", readFileSync("docs/issues/measure.md"));\n');
		commit(repo, "mise.toml", '[tasks.setup]\nrun = "bun setup.ts"\n');
		const fixture = async (handle: string, base?: string, prepare?: (cwd: string) => Promise<string | void>) => {
			const worker = await spawn({ cwd: repo, run: "fixture", handle, base, prepare, prompt: "old contract", command: "sleep 120" });
			workers.push(worker);
			return worker;
		};
		const previous = await fixture("previous");
		const previousHead = commit(previous.dir, "result.txt", "retained packet\n");
		const handler = await fixture("handler");
		commit(handler.dir, ticket, ruling);
		await merge(handler);
		const decision = git(repo, "rev-parse", "HEAD");
		const successor = await fixture("successor", previousHead, async cwd => {
			refreshWorker(cwd, repo);
			return readFileSync(join(cwd, ticket), "utf8");
		});
		expect(git(successor.dir, "merge-base", "--is-ancestor", decision, "HEAD")).toBe("");
		expect(git(successor.dir, "merge-base", "--is-ancestor", previousHead, "HEAD")).toBe("");
		expect(readFileSync(join(successor.dir, "result.txt"), "utf8")).toBe("retained packet\n");
		// Worker setup runs after host admission, so it lands shortly after spawn returns.
		for (let i = 0; i < 100 && !existsSync(join(successor.dir, "setup-contract")); i++) await new Promise(r => setTimeout(r, 100));
		expect(readFileSync(join(successor.dir, "setup-contract"), "utf8")).toBe(ruling);
		const record = await getThread(successor.threadId!);
		expect(record?.launch?.prompt).toContain(ruling);
		expect(record?.launch?.prompt).not.toContain("old contract");
		expect(git(repo, "config", "branch.successor.ab-parent")).toBe("main");
	} finally {
		try { await Promise.all(workers.map(worker => worker.close())); }
		finally { process.env = saved; rmSync(root, { recursive: true, force: true }); }
	}
}, 30_000);
