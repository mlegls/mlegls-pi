import { afterAll, beforeAll, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ThreadMergeConflict, abandonThread, alignIndex, integrateThread } from "./lifecycle";
import { newThread, workerOf } from "./runtime";
import { fakeBb } from "./fake-bb";
import { keepProcessLogs } from "./lifecycle-cleanup";
import type { NewThreadOptions, WorkerThread } from "./types";

// Unit tests for integration and retirement of worker threads on a fake bb CLI: no pi, no model.
const root = realpathSync(mkdtempSync("/tmp/ab-lifecycle-test-"));
const saved = { ...process.env };
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
const repo = join(root, "repo");
const commit = (cwd: string, file: string, text: string) => {
	writeFileSync(join(cwd, file), text);
	git(cwd, "add", file);
	git(cwd, "commit", "-m", file + ": " + text);
};
let n = 0;
const fresh = () => "t" + ++n;

const spawn = (cwd: string, name: string, extra: Partial<NewThreadOptions> = {}) => newThread({ cwd, worktree: name, worker: { run: "t", handle: name }, ...extra });
async function until<T>(read: () => Promise<T | undefined | false>): Promise<T> {
	for (let i = 0; i < 200; i++) { const value = await read(); if (value) return value; await new Promise(r => setTimeout(r, 100)); }
	throw new Error("timed out");
}

/** parent (on main) with a child branched from it; both then edit conflict.txt differently. */
async function conflicting(): Promise<{ parent: WorkerThread; child: WorkerThread }> {
	const name = fresh();
	const parent = await spawn(repo, name + "p");
	const child = await spawn(parent.cwd, name + "c");
	commit(parent.cwd, "conflict.txt", "parent");
	commit(child.cwd, "conflict.txt", "child");
	return { parent, child };
}

beforeAll(() => {
	for (const key of Object.keys(process.env)) if (/^(?:PI_WM_.*|PI_BOARD_.*|PI_SESSION_.*|AB_THREAD_ID|BB_.*|TMUX.*)$/.test(key)) delete process.env[key];
	Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"), PI_CODING_AGENT_DIR: join(root, "agent"), MISE_TRUSTED_CONFIG_PATHS: root });
	fakeBb(root);
	mkdirSync(repo);
	git(repo, "init", "-b", "main");
	git(repo, "config", "user.name", "t");
	git(repo, "config", "user.email", "t@example.invalid");
	writeFileSync(join(repo, "conflict.txt"), "seed");
	git(repo, "add", ".");
	git(repo, "commit", "-m", "seed");
});

afterAll(async () => {
	process.env = saved;
	rmSync(root, { recursive: true, force: true });
});

test("raw integrate follows ab-parent, refuses a dirty or unprepared source, lands beside unrelated destination edits, and leaves threads active", async () => {
	const name = fresh();
	const mid = await spawn(repo, name + "m");
	const kid = await spawn(mid.cwd, name + "k");
	commit(kid.cwd, name + ".txt", "kid");
	// Merge lineage is separate from spawn lineage: kid was spawned by mid but now merges into main.
	git(repo, "config", "branch." + kid.branch + ".ab-parent", "main");
	const mainBefore = git(repo, "rev-parse", "main");

	writeFileSync(join(kid.cwd, "dirty.txt"), "x");
	await expect(integrateThread(kid.id)).rejects.toThrow("uncommitted changes");
	rmSync(join(kid.cwd, "dirty.txt"));
	await expect(integrateThread(kid.id, { prepare: async () => { throw new Error("prepare failed"); } })).rejects.toThrow("prepare failed");
	await expect(integrateThread(kid.id, { prepare: async () => { writeFileSync(join(kid.cwd, "left.txt"), "x"); } })).rejects.toThrow("preparation left");
	rmSync(join(kid.cwd, "left.txt"));
	expect(git(repo, "rev-parse", "main")).toBe(mainBefore);

	// Destination edits block only where the merge would overwrite them.
	writeFileSync(join(repo, name + ".txt"), "in place");
	await expect(integrateThread(kid.id)).rejects.toThrow("would be overwritten");
	rmSync(join(repo, name + ".txt"));
	writeFileSync(join(repo, name + "-unrelated.txt"), "in place");

	const from = process.cwd(); // not any thread's checkout
	expect(from).not.toBe(repo);
	expect(await integrateThread(kid.id)).toMatchObject({ branch: kid.branch, parentBranch: "main", path: repo, mode: "rebase" });
	expect(readFileSync(join(repo, name + ".txt"), "utf8")).toBe("kid");
	expect(readFileSync(join(repo, name + "-unrelated.txt"), "utf8")).toBe("in place");
	rmSync(join(repo, name + "-unrelated.txt"));
	expect(git(mid.cwd, "branch", "--contains", git(kid.cwd, "rev-parse", "HEAD"))).not.toContain(mid.branch!);
	expect(await workerOf(kid.id)).toBeDefined();
	expect(existsSync(kid.cwd)).toBe(true);
});

test("retiring an unfinished worker moves ignored state setup can't regenerate aside; a finished one discards it", async () => {
	writeFileSync(join(repo, ".git", "info", "exclude"), "local-db/\nnode_modules/\n.env\n.wm/\n");
	writeFileSync(join(repo, ".env"), "SECRET=1\n");
	const seed = (cwd: string) => {
		mkdirSync(join(cwd, "local-db"), { recursive: true });
		writeFileSync(join(cwd, "local-db", "import.bin"), "irreplaceable");
		mkdirSync(join(cwd, "node_modules", "dep"), { recursive: true });
		writeFileSync(join(cwd, "node_modules", "dep", "index.js"), "");
		writeFileSync(join(cwd, ".env"), "SECRET=1\n");
		writeFileSync(join(cwd, "draft.txt"), "untracked");
		mkdirSync(join(cwd, ".wm", "drive"), { recursive: true });
		writeFileSync(join(cwd, ".wm", "launch.env"), "PI_WM_HANDLE='drive'\n");
		writeFileSync(join(cwd, ".wm", "drive", "debug.txt"), "scan");
	};
	const name = fresh();
	const t = await spawn(repo, name);
	seed(t.cwd);
	const result = await abandonThread(t.id);
	const kept = join(repo + "__retired", name);
	// A worker's .wm/ output is kept; wm's own launch file is not.
	expect(result.kept).toEqual([{ worktree: t.cwd, path: kept, entries: [".wm/drive/", "local-db/"] }]);
	expect(readFileSync(join(kept, "local-db", "import.bin"), "utf8")).toBe("irreplaceable");
	expect(readFileSync(join(kept, ".wm", "drive", "debug.txt"), "utf8")).toBe("scan");
	expect(existsSync(join(kept, ".wm", "launch.env"))).toBe(false);
	expect(readFileSync(join(kept, "RETIRED.md"), "utf8")).toContain("branch: " + t.branch);
	expect(existsSync(join(kept, "node_modules"))).toBe(false);
	expect(existsSync(join(kept, ".env"))).toBe(false);
	expect(existsSync(t.cwd)).toBe(false);
	// Untracked files still go to the WIP commit, which keeps the branch.
	expect(git(repo, "show", t.branch + ":draft.txt")).toBe("untracked");

	const done = fresh();
	const u = await spawn(repo, done);
	seed(u.cwd);
	git(repo, "config", "--add", "wm.disposable", "local-db");
	git(repo, "config", "--add", "wm.disposable", ".wm/drive");
	try { expect((await abandonThread(u.id)).kept).toBeUndefined(); }
	finally { git(repo, "config", "--unset-all", "wm.disposable"); }
	const v = await spawn(repo, fresh());
	seed(v.cwd);
	expect((await abandonThread(v.id, { discardIgnored: true })).kept).toBeUndefined();
	expect(existsSync(join(repo + "__retired", done))).toBe(false);
	expect(existsSync(v.cwd)).toBe(false);
	rmSync(join(repo, ".git", "info", "exclude"));
	rmSync(join(repo, ".env"));
});

test("retirement copies the managed-process logs a pi holds open into its worktree's .wm/processes/", async () => {
	const logs = join(root, "tmp", "pi-processes-abc");
	mkdirSync(logs, { recursive: true });
	writeFileSync(join(logs, "proc_1-combined.log"), "server output\n");
	writeFileSync(join(logs, "proc_2-combined.log"), "finished earlier\n");
	const holder = Bun.spawn(["bash", "-c", "exec 3>>\"$1\"; sleep 30", "_", join(logs, "proc_1-combined.log")]);
	const worktree = join(root, "wt-logs");
	mkdirSync(worktree);
	try {
		await until(async () => execFileSync("lsof", ["-a", "-p", String(holder.pid), "-Fn"], { encoding: "utf8" }).includes("proc_1-combined.log"));
		expect(await keepProcessLogs(worktree, [holder.pid])).toEqual([join(worktree, ".wm", "processes", "pi-processes-abc")]);
		expect(readFileSync(join(worktree, ".wm", "processes", "pi-processes-abc", "proc_2-combined.log"), "utf8")).toBe("finished earlier\n");
		expect(await keepProcessLogs(worktree, [])).toEqual([]);
	} finally { holder.kill(); }
});

test("integrate returns what the destination's merge printed, a failing post-merge hook included", async () => {
	const name = fresh();
	const t = await spawn(repo, name);
	commit(t.cwd, name + ".txt", "hooked");
	const hooks = join(root, "hooks-" + name);
	mkdirSync(hooks);
	writeFileSync(join(hooks, "post-merge"), "#!/bin/sh\n[ \"$(git write-tree)\" = \"$(git rev-parse HEAD^{tree})\" ] && echo 'index at HEAD'\necho 'not publishing' >&2\necho 'husky - post-merge script failed (code 1)'\nexit 1\n", { mode: 0o755 });
	git(repo, "config", "core.hooksPath", hooks);
	try {
		const result = await integrateThread(t.id);
		expect(result?.output).toContain("Fast-forward");
		expect(result?.output).toContain("husky - post-merge script failed (code 1)");
		expect(result?.output).toContain("not publishing");
		expect(result?.output).toContain("index at HEAD");
		expect(result?.output).toContain("integrate: post-merge hook exited 1");
	} finally { git(repo, "config", "--unset", "core.hooksPath"); }
});

test("after a landing, index entries left at the pre-landing version are reset to HEAD; other staged intent stays", async () => {
	const dir = join(root, "align-" + fresh());
	mkdirSync(dir);
	git(dir, "init", "-q", "-b", "main"); git(dir, "config", "user.name", "t"); git(dir, "config", "user.email", "t@example.invalid");
	for (const [f, t] of [["changed.txt", "old"], ["removed.txt", "gone"], ["intent.txt", "a"]]) writeFileSync(join(dir, f), t);
	git(dir, "add", "."); git(dir, "commit", "-qm", "base");
	const base = git(dir, "rev-parse", "HEAD");
	writeFileSync(join(dir, "changed.txt"), "new"); writeFileSync(join(dir, "added.txt"), "added"); rmSync(join(dir, "removed.txt"));
	git(dir, "add", "-A"); git(dir, "commit", "-qm", "landing");
	// What the reconciler found in concept's main checkout: HEAD and the working tree landed, the index did not.
	git(dir, "read-tree", base);
	writeFileSync(join(dir, "intent.txt"), "staged by someone"); git(dir, "add", "intent.txt");
	expect((await alignIndex(dir, base)).sort()).toEqual(["added.txt", "changed.txt", "removed.txt"]);
	expect(git(dir, "diff", "--cached", "--name-only", "HEAD")).toBe("intent.txt");
	expect(git(dir, "status", "--porcelain")).toBe("M  intent.txt");
	expect(await alignIndex(dir, base)).toEqual([]);
});

test("raw integrate names a missing or deleted ab-parent instead of choosing another target", async () => {
	const name = fresh();
	const t = await spawn(repo, name);
	commit(t.cwd, name + ".txt", "x");
	git(repo, "config", "--unset", "branch." + t.branch + ".ab-parent");
	await expect(integrateThread(t.id)).rejects.toThrow("missing ab-parent");
	git(repo, "branch", name + "-gone");
	git(repo, "config", "branch." + t.branch + ".ab-parent", name + "-gone");
	expect(() => git(repo, "branch", "-D", name + "-gone")).not.toThrow();
	await expect(integrateThread(t.id)).rejects.toThrow();
	expect(git(repo, "ls-tree", "--name-only", "main")).not.toContain(name + ".txt");
});

test("a merge-bearing child takes its base by merge, keeping its earlier resolution commits", async () => {
	const name = fresh();
	const t = await spawn(repo, name);
	commit(repo, name + "-a.txt", "a");
	commit(t.cwd, name + "-0.txt", "0");
	git(t.cwd, "merge", "--no-ff", "--no-edit", "main"); // child already carries a merge commit
	commit(t.cwd, name + "-c.txt", "c");
	const merge = git(t.cwd, "rev-list", "--merges", "-1", "HEAD");
	commit(repo, name + "-b.txt", "b");
	await integrateThread(t.id);
	expect(git(repo, "merge-base", "--is-ancestor", merge, "main") === "").toBe(true); // a rebase would have rewritten it
	expect(git(repo, "rev-parse", "main")).toBe(git(t.cwd, "rev-parse", "HEAD"));
});

test("raw conflict throws its files, leaves the child clean and unapplied, and sends nothing", async () => {
	const { parent, child } = await conflicting();
	const head = git(child.cwd, "rev-parse", "HEAD");
	const error = await integrateThread(child.id).catch(e => e);
	expect(error).toBeInstanceOf(ThreadMergeConflict);
	expect(error).toMatchObject({ threadId: child.id, branch: child.branch, parentBranch: parent.branch, files: ["conflict.txt"] });
	expect(git(child.cwd, "status", "--porcelain")).toBe("");
	expect(git(child.cwd, "rev-parse", "HEAD")).toBe(head);
	expect(git(parent.cwd, "log", "--oneline", "-1", "--", "conflict.txt")).toContain("parent");
});
