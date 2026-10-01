import { afterAll, beforeAll, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { allThreads, saveThread, threadForSession, workerThread } from "./registry";
import { ensureTerminal, historyThread, listThreads, newThread, sendThread } from "./runtime";
import { terminals, zmx } from "./zmx";

// Replays docs/attachments/thread-registry-and-zmx-launch/driver-log.md checks C1, C2, C5, C6 and the
// ambiguous bare worker handle of edge-observations.txt over shell fixtures (no pi, no model).
const root = realpathSync(mkdtempSync("/tmp/ab-thread-test-")); // short: zmx socket paths are length-limited
const saved = { ...process.env };
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
const repo = join(root, "repo");
const reader = { cmd: "echo READY; read value; echo SUBMITTED:$value; sleep 300" };

async function until<T>(read: () => Promise<T | undefined | false>): Promise<T> {
	for (let i = 0; i < 100; i++) { const value = await read(); if (value) return value; await new Promise(r => setTimeout(r, 100)); }
	throw new Error("timed out");
}

beforeAll(() => {
	for (const key of Object.keys(process.env)) if (/^(?:PI_WM_.*|PI_BOARD_.*|PI_SESSION_.*|AB_THREAD_ID|ZMX_.*|TMUX.*)$/.test(key)) delete process.env[key];
	Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"), PI_BOARD_DIR: join(root, "board"), PI_CODING_AGENT_DIR: join(root, "agent"), ZMX_DIR: join(root, "zmx"), MISE_TRUSTED_CONFIG_PATHS: root });
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
	for (const t of await terminals().catch(() => [])) await zmx(["kill", t.name, "--force"]).catch(() => {});
	process.env = saved;
	rmSync(root, { recursive: true, force: true });
});

test("owning thread sets up once, guests do not own, aux ensure is idempotent, send is literal", async () => {
	const owner = await newThread({ cwd: repo, worktree: "owner", launch: reader });
	expect(owner).toMatchObject({ ownership: "owner", branch: "owner", cwd: join(repo + "__worktrees", "owner") });
	expect(git(repo, "config", "branch.owner.ab-parent")).toBe("main");
	expect(readFileSync(join(owner.cwd, "setup-marker"), "utf8")).toBe("setup\n");
	const guest = await newThread({ cwd: repo, in: owner.cwd, parent: owner.id, launch: reader });
	expect(guest).toMatchObject({ ownership: "guest", cwd: owner.cwd });
	expect(readFileSync(join(owner.cwd, "setup-marker"), "utf8")).toBe("setup\n");

	const first = await ensureTerminal(owner.id, "server");
	const pid = (await terminals()).find(t => t.name === first.name)!.pid;
	await ensureTerminal(owner.id, "server");
	const named = (await terminals()).filter(t => t.name === owner.id + ".server");
	expect(named.map(t => ({ pid: t.pid, thread: t.thread, role: t.role }))).toEqual([{ pid, thread: owner.id, role: "server" }]);

	await zmx(["send", first.name, "pwd\r"]);
	await until(async () => (await zmx(["history", first.name])).includes(owner.cwd)); // aux shell starts in the thread cwd
	await until(async () => (await historyThread(owner.id)).includes("READY"));
	await sendThread(owner.id, "literal $HOME ; 'q'");
	await new Promise(r => setTimeout(r, 500));
	expect(await historyThread(owner.id)).not.toContain("SUBMITTED");
	await sendThread(owner.id, "\r");
	await until(async () => (await historyThread(owner.id, 8)).includes("SUBMITTED:literal $HOME ; 'q'"));

	const spawn = await listThreads({ cwd: repo });
	expect(spawn.map(r => [r.thread.id, r.depth])).toEqual([[owner.id, 0], [guest.id, 1]]);
	expect(spawn[0]!.terminals.map(t => t.name).sort()).toEqual([owner.id + ".agent", owner.id + ".server"]);
	expect(await threadForSession(owner.sessionId)).toMatchObject({ id: owner.id });
});

test("a bare worker handle shared by two runs is ambiguous until its run is given", async () => {
	const base = (await allThreads())[0]!;
	for (const run of ["a", "b"]) await saveThread({ ...base, id: "w-" + run, sessionId: "w-" + run, worker: { run, handle: "same" } });
	await expect(workerThread("same", repo)).rejects.toThrow("Ambiguous worker same");
	expect((await workerThread("same", repo, "b"))?.id).toBe("w-b");
});

// Reviewer measurement of the core join's collector-SHA premise: a worker branched from a base SHA that is not
// its spawning checkout's tip (as reconcile launches review/implement workers) integrates into that checkout's branch.
test("a worker spawned from a collector's older base SHA records the collector branch as ab-parent", async () => {
	const collector = await newThread({ cwd: repo, worktree: "collector", launch: reader });
	const comparison = git(collector.cwd, "rev-parse", "HEAD");
	writeFileSync(join(collector.cwd, "landed.txt"), "landed\n");
	git(collector.cwd, "add", "landed.txt");
	git(collector.cwd, "commit", "-m", "landed child");
	const tip = git(collector.cwd, "rev-parse", "HEAD");
	expect(tip).not.toBe(comparison);
	const worker = await newThread({ cwd: collector.cwd, base: comparison, worker: { run: "r", handle: "based" }, launch: reader });
	expect(git(worker.cwd, "rev-parse", "HEAD")).toBe(comparison); // branched from the base SHA, not the collector tip
	expect(git(repo, "config", "branch.based.ab-parent")).toBe("collector"); // destination follows the spawning branch
});
