import { afterAll, beforeAll, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { threadForSession } from "./registry";
import { bbThreads, bbWorkerThread } from "./bb";
import { historyThread, newThread, sendThread } from "./runtime";
import { fakeBb } from "./fake-bb";

// Replays docs/attachments/thread-registry-and-zmx-launch/driver-log.md checks C1, C2, C5, C6 and the
// ambiguous bare worker handle of edge-observations.txt over threads on a fake bb CLI (no pi, no model).
const root = realpathSync(mkdtempSync("/tmp/ab-thread-test-"));
const saved = { ...process.env };
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
const repo = join(root, "repo");
let bb: ReturnType<typeof fakeBb>;

beforeAll(() => {
	for (const key of Object.keys(process.env)) if (/^(?:PI_WM_.*|PI_BOARD_.*|PI_SESSION_.*|AB_THREAD_ID|BB_.*|TMUX.*)$/.test(key)) delete process.env[key];
	Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"), PI_CODING_AGENT_DIR: join(root, "agent"), MISE_TRUSTED_CONFIG_PATHS: root });
	bb = fakeBb(root);
	mkdirSync(repo);
	git(repo, "init", "-b", "main");
	git(repo, "config", "user.name", "t");
	git(repo, "config", "user.email", "t@example.invalid");
	writeFileSync(join(repo, ".gitignore"), "setup-marker\n");
	writeFileSync(join(repo, "mise.toml"), '[tasks.setup]\nrun = "echo setup >> setup-marker"\n');
	git(repo, "add", ".");
	git(repo, "commit", "-m", "seed");
});

afterAll(async () => {
	process.env = saved;
	rmSync(root, { recursive: true, force: true });
});

test("owning thread sets up once, guests do not own, send reaches the bb thread literally", async () => {
	const owner = await newThread({ cwd: repo, worktree: "owner" });
	expect(owner).toMatchObject({ ownership: "owner", branch: "owner", cwd: join(repo + "__worktrees", "owner") });
	expect(git(repo, "config", "branch.owner.ab-parent")).toBe("main");
	expect(readFileSync(join(owner.cwd, "setup-marker"), "utf8")).toBe("setup\n");
	const guest = await newThread({ cwd: repo, in: owner.cwd, parent: owner.id });
	expect(guest).toMatchObject({ ownership: "guest", cwd: owner.cwd });
	expect(readFileSync(join(owner.cwd, "setup-marker"), "utf8")).toBe("setup\n");

	// Each thread is one bb thread in its own environment; the owner's pi starts in its worktree.
	expect(bb.threads().map(t => t.environment).sort()).toEqual([owner.cwd, owner.cwd].sort());
	await sendThread(owner.id, "literal $HOME ; 'q'");
	expect(bb.threads().find(t => t.id === owner.bb)!.tells).toEqual(["literal $HOME ; 'q'"]);
	expect(await historyThread(owner.id, 1)).toBe("literal $HOME ; 'q'\n");

	expect(await threadForSession(owner.sessionId)).toMatchObject({ id: owner.id });
});

test("a bare worker handle shared by two runs is ambiguous until its run is given", async () => {
	for (const run of ["a", "b"]) bb.addThread("w-" + run, repo, run + "/same");
	const threads = await bbThreads();
	expect(() => bbWorkerThread(threads, "same")).toThrow("Ambiguous worker same");
	expect(bbWorkerThread(threads, "same", "b")?.id).toBe("w-b");
});

// Reviewer measurement of the core join's collector-SHA premise: a worker branched from a base SHA that is not
// its spawning checkout's tip (as reconcile launches review/implement workers) integrates into that checkout's branch.
test("a worker spawned from a collector's older base SHA records the collector branch as ab-parent", async () => {
	const collector = await newThread({ cwd: repo, worktree: "collector" });
	const comparison = git(collector.cwd, "rev-parse", "HEAD");
	writeFileSync(join(collector.cwd, "landed.txt"), "landed\n");
	git(collector.cwd, "add", "landed.txt");
	git(collector.cwd, "commit", "-m", "landed child");
	const tip = git(collector.cwd, "rev-parse", "HEAD");
	expect(tip).not.toBe(comparison);
	const worker = await newThread({ cwd: collector.cwd, base: comparison, worker: { run: "r", handle: "based" } });
	expect(git(worker.cwd, "rev-parse", "HEAD")).toBe(comparison); // branched from the base SHA, not the collector tip
	expect(git(repo, "config", "branch.based.ab-parent")).toBe("collector"); // destination follows the spawning branch
});
