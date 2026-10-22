import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { finishTask, reapTask, startTask, taskOf } from "./task";
import { canonicalTarget, targets } from "../extensions/task/index";

const root = realpathSync(mkdtempSync(join(tmpdir(), "task-")));
const repo = join(root, "repo");
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, "-c", "user.email=t@t", "-c", "user.name=t", ...args], { encoding: "utf8" }).trimEnd();
const saved = process.env.BB_CLI;
beforeAll(() => {
	process.env.BB_CLI = "/usr/bin/false";
	mkdirSync(join(repo, "docs/issues"), { recursive: true });
	git(repo, "init", "-q", "-b", "main");
	writeFileSync(join(repo, "a.txt"), "a\n");
	writeFileSync(join(repo, "other.txt"), "other\n");
	writeFileSync(join(repo, "docs/issues/x.md"), "---\nstage: idea\n---\n");
	writeFileSync(join(repo, ".gitignore"), "desk/\n");
	git(repo, "add", "-A"); git(repo, "commit", "-qm", "init");
});
afterAll(() => { process.env.BB_CLI = saved; rmSync(root, { recursive: true, force: true }); });

test("the guard refuses only trackable paths in a main worktree", () => {
	expect(targets({ edits: [{ path: "a" }, { path: "b" }] })).toEqual(["a", "b"]);
	expect(targets({ path: "c", content: "" })).toEqual(["c"]);
	expect(canonicalTarget(join(repo, "a.txt"))).toBe(repo);
	expect(canonicalTarget(join(repo, "new/dir/file.ts"))).toBe(repo);
	expect(canonicalTarget(join(repo, "desk/ATTENTION.md"))).toBeUndefined();
	expect(canonicalTarget(join(root, "elsewhere.txt"))).toBeUndefined();
	git(repo, "config", "pi.taskWorktrees", "false");
	expect(canonicalTarget(join(repo, "a.txt"))).toBeUndefined();
	git(repo, "config", "--unset", "pi.taskWorktrees");
});

test("a task integrates serially into its target without touching the checkout's other dirty or staged files, then is reaped", async () => {
	// Another session's work in progress in the shared checkout.
	writeFileSync(join(repo, "other.txt"), "someone else's edit\n");
	writeFileSync(join(repo, "staged.txt"), "someone else's staged file\n");
	git(repo, "add", "staged.txt");
	const one = await startTask(repo, "task-one"), two = await startTask(repo, "task-two");
	expect(one).toMatchObject({ branch: "task-one", parent: "main", path: join(root, "repo__worktrees", "task-one") });
	expect(existsSync(join(one.path, "docs/issues/x.md"))).toBe(false); // the tracker stays global
	expect(canonicalTarget(join(one.path, "a.txt"))).toBeUndefined();
	expect(taskOf(one.path)).toMatchObject({ name: "task-one", parent: "main", project: repo });
	expect(taskOf(repo)).toBeUndefined();
	await expect(startTask(repo, "task-one")).rejects.toThrow(/already exists/);
	writeFileSync(join(one.path, "one.txt"), "1\n"); git(one.path, "add", "one.txt"); git(one.path, "commit", "-qm", "one");
	writeFileSync(join(two.path, "two.txt"), "2\n"); git(two.path, "add", "two.txt"); git(two.path, "commit", "-qm", "two");
	writeFileSync(join(two.path, "loose.txt"), "uncommitted\n");
	await expect(finishTask(two.path, { reap: false })).rejects.toThrow(/uncommitted/);
	rmSync(join(two.path, "loose.txt"));
	const [a, b] = await Promise.all([finishTask(one.path, { reap: false }), finishTask(two.path, { reap: false })]);
	expect([a.parentBranch, b.parentBranch]).toEqual(["main", "main"]);
	expect(git(repo, "log", "--format=%s", "main").split("\n").slice(0, 2).sort()).toEqual(["one", "two"]);
	expect(git(repo, "status", "--porcelain").split("\n").sort()).toEqual([" M other.txt", "A  staged.txt"]);
	expect(git(repo, "show", ":staged.txt")).toBe("someone else's staged file");
	const reaped = await reapTask(one.path, { poll: 50 });
	expect(reaped).toMatchObject({ removed: true, branch: "deleted" });
	expect(existsSync(one.path)).toBe(false);
	expect(git(repo, "branch", "--list", "task-one")).toBe("");
}, 30_000);

test("the extension blocks an interactive bb session's edit in the checkout, names the route, and /edit-here lifts it", async () => {
	const { default: extension } = await import("../extensions/task/index");
	const handlers: Record<string, Function> = {}, commands: Record<string, { handler: Function }> = {};
	const pi = { on: (e: string, h: Function) => { handlers[e] = h; }, registerCommand: (n: string, c: { handler: Function }) => { commands[n] = c; }, sendMessage: () => {} };
	const env = { BB_THREAD_ID: process.env.BB_THREAD_ID, PI_WM_HANDLE: process.env.PI_WM_HANDLE };
	process.env.BB_THREAD_ID = "thr_test"; delete process.env.PI_WM_HANDLE;
	try {
		extension(pi as never);
		const call = (toolName: string, input: object) => handlers.tool_call({ toolName, input }, { cwd: repo });
		const blocked = call("edit", { edits: [{ path: "a.txt", old: "a", new: "b" }] });
		expect(blocked.block).toBe(true);
		expect(blocked.reason).toContain("ab task start");
		expect(call("write", { path: "desk/notes.md", content: "" })).toBeUndefined();
		expect(call("bash", { command: "echo hi > a.txt" })).toBeUndefined();
		expect(handlers.before_agent_start({ systemPrompt: "base" }, { cwd: repo })).toBeUndefined();
		await commands["edit-here"].handler("", { ui: { notify() {} } });
		expect(call("write", { path: "a.txt", content: "" })).toBeUndefined();
	} finally { Object.assign(process.env, env); for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k]; }
});

test("finish integrates a bb-managed worktree into an explicit target, once recorded", async () => {
	const path = join(root, "bb-managed");
	git(repo, "worktree", "add", "-q", "-b", "bb/thing", path, "main");
	writeFileSync(join(path, "bb.txt"), "bb\n"); git(path, "add", "bb.txt"); git(path, "commit", "-qm", "bb");
	await expect(finishTask(path)).rejects.toThrow(/records no target/);
	const r = await finishTask(path, { into: "main" });
	expect(r.cleanup).toMatch(/bb retires/);
	expect(git(repo, "log", "-1", "--format=%s", "main")).toBe("bb");
	await expect(finishTask(path, { into: "other" })).rejects.toThrow(/already targets main/);
});
