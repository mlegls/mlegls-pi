import { afterAll, beforeAll, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { send } from "../board/store";
import { ThreadMergeConflict, abandonThread, archiveThread, integrateThread } from "./lifecycle";
import { getThread, setCurrentSession } from "./registry";
import { newThread } from "./runtime";
import { fakeBb } from "./fake-bb";
import { keepProcessLogs } from "./lifecycle-cleanup";
import type { ThreadRecord } from "./types";

// Unit tests for the contract controls docs/attachments/thread-archive-and-abandon/drive.md leaves to review
// (C2 report identity/freshness, C6 raw destination/edge controls). Threads on a fake bb CLI: no pi, no model.
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

async function until<T>(read: () => Promise<T | undefined | false>): Promise<T> {
	for (let i = 0; i < 200; i++) { const value = await read(); if (value) return value; await new Promise(r => setTimeout(r, 100)); }
	throw new Error("timed out");
}
const pending = (promise: Promise<unknown>, ms = 1500) =>
	Promise.race([promise.then(() => false), new Promise<boolean>(r => setTimeout(() => r(true), ms))]);

/** parent (on main) with a child spawned from it; both then edit conflict.txt differently. */
async function conflicting(): Promise<{ parent: ThreadRecord; child: ThreadRecord }> {
	const name = fresh();
	const parent = await newThread({ cwd: repo, worktree: name + "p" });
	const child = await newThread({ cwd: parent.cwd, parent: parent.id, worktree: name + "c" });
	commit(parent.cwd, "conflict.txt", "parent");
	commit(child.cwd, "conflict.txt", "child");
	return { parent, child };
}
const topic = (t: ThreadRecord) => "thread/" + t.id;
const report = (t: ThreadRecord, session: string, tag: string, body: string) =>
	send({ topic: topic(t), tags: [tag], from: { session, name: "test" }, body });

beforeAll(() => {
	for (const key of Object.keys(process.env)) if (/^(?:PI_WM_.*|PI_BOARD_.*|PI_SESSION_.*|AB_THREAD_ID|BB_.*|TMUX.*)$/.test(key)) delete process.env[key];
	Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"), PI_BOARD_DIR: join(root, "board"), PI_CODING_AGENT_DIR: join(root, "agent"), MISE_TRUSTED_CONFIG_PATHS: root });
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
	const mid = await newThread({ cwd: repo, worktree: name + "m" });
	const kid = await newThread({ cwd: mid.cwd, parent: mid.id, worktree: name + "k" });
	commit(kid.cwd, name + ".txt", "kid");
	// Merge lineage is separate from spawn lineage: kid was spawned by mid but now merges into main.
	git(repo, "config", "branch." + kid.branch + ".ab-parent", "main");
	const mainBefore = git(repo, "rev-parse", "main");

	writeFileSync(join(kid.cwd, "dirty.txt"), "x");
	await expect(integrateThread(kid.id)).rejects.toThrow("uncommitted changes");
	rmSync(join(kid.cwd, "dirty.txt"));
	await expect(integrateThread(kid.id, { prepare: async () => { throw new Error("prepare failed"); } })).rejects.toThrow("prepare failed");
	await expect(integrateThread(kid.id, { prepare: async t => { writeFileSync(join(t.cwd, "left.txt"), "x"); } })).rejects.toThrow("preparation left");
	rmSync(join(kid.cwd, "left.txt"));
	expect(git(repo, "rev-parse", "main")).toBe(mainBefore);

	// Destination edits block only where the merge would overwrite them.
	writeFileSync(join(repo, name + ".txt"), "in place");
	await expect(integrateThread(kid.id)).rejects.toThrow("would be overwritten");
	rmSync(join(repo, name + ".txt"));
	writeFileSync(join(repo, name + "-unrelated.txt"), "in place");

	const from = process.cwd(); // not any thread's checkout
	expect(from).not.toBe(repo);
	expect(await integrateThread(kid.id)).toMatchObject({ branch: kid.branch!, parentBranch: "main", path: repo, mode: "rebase" });
	expect(readFileSync(join(repo, name + ".txt"), "utf8")).toBe("kid");
	expect(readFileSync(join(repo, name + "-unrelated.txt"), "utf8")).toBe("in place");
	rmSync(join(repo, name + "-unrelated.txt"));
	expect(git(mid.cwd, "branch", "--contains", git(kid.cwd, "rev-parse", "HEAD"))).not.toContain(mid.branch!);
	expect((await getThread(kid.id))!.archived).toBe(false);
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
		writeFileSync(join(cwd, ".wm", "launch.env"), "PI_BOARD_TOPIC='run/drive'\n");
		writeFileSync(join(cwd, ".wm", "drive", "debug.txt"), "scan");
	};
	const name = fresh();
	const t = await newThread({ cwd: repo, worktree: name });
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
	const u = await newThread({ cwd: repo, worktree: done });
	seed(u.cwd);
	git(repo, "config", "--add", "wm.disposable", "local-db");
	git(repo, "config", "--add", "wm.disposable", ".wm/drive");
	try { expect((await abandonThread(u.id)).kept).toBeUndefined(); }
	finally { git(repo, "config", "--unset-all", "wm.disposable"); }
	const v = await newThread({ cwd: repo, worktree: fresh() });
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
	const t = await newThread({ cwd: repo, worktree: name });
	commit(t.cwd, name + ".txt", "hooked");
	const hooks = join(root, "hooks-" + name);
	mkdirSync(hooks);
	writeFileSync(join(hooks, "post-merge"), "#!/bin/sh\necho 'not publishing' >&2\necho 'husky - post-merge script failed (code 1)'\nexit 1\n", { mode: 0o755 });
	git(repo, "config", "core.hooksPath", hooks);
	try {
		const result = await integrateThread(t.id);
		expect(result?.output).toContain("Fast-forward");
		expect(result?.output).toContain("husky - post-merge script failed (code 1)");
		expect(result?.output).toContain("not publishing");
	} finally { git(repo, "config", "--unset", "core.hooksPath"); }
});

test("raw integrate names a missing or deleted ab-parent instead of choosing another target", async () => {
	const name = fresh();
	const t = await newThread({ cwd: repo, worktree: name });
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
	const t = await newThread({ cwd: repo, worktree: name });
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
	expect((await getThread(child.id))!.blocked).toBeUndefined();
});

test("archive conflict resumes only on the current canonical session's fresh done", async () => {
	const { parent, child } = await conflicting();
	const archive = archiveThread(parent.id);
	await until(async () => (await getThread(child.id))!.blocked);
	expect((await getThread(child.id))!.blocked).toMatchObject({ action: "archive", parentBranch: parent.branch, files: ["conflict.txt"] });

	report(child, parent.sessionId, "done", "done not the child"); // another agent
	send({ topic: topic(child), tags: [], from: { session: child.sessionId }, body: "done" }); // untagged chatter is not a report
	expect(await pending(archive)).toBe(true);
	expect((await getThread(child.id))!.archived).toBe(false);

	const oldSession = child.sessionId;
	const next = "00000000-0000-7000-8000-" + String(Date.now()).padStart(12, "0");
	await setCurrentSession(child.id, { id: next, file: join(root, "next.jsonl") });
	await expect(async () => git(child.cwd, "merge", "--no-edit", "--no-verify", parent.branch!)).toThrow(); // conflicts; resolve below
	writeFileSync(join(child.cwd, "conflict.txt"), "resolved");
	git(child.cwd, "add", "conflict.txt");
	git(child.cwd, "commit", "--no-edit");
	report(child, oldSession, "done", "done stale session");
	expect(await pending(archive)).toBe(true);
	expect(git(repo, "show", "main:conflict.txt")).toBe("seed");

	report(child, next, "done", "done resolved");
	const result = await archive;
	expect(result.closed).toEqual([child.id, parent.id]);
	expect(result.branchesDeleted.sort()).toEqual([child.branch!, parent.branch!].sort());
	expect(git(repo, "show", "main:conflict.txt")).toBe("resolved");
	expect(existsSync(child.cwd) || existsSync(parent.cwd)).toBe(false);
}, 30_000);

for (const status of ["needs-input", "checkpoint", "turn-end"]) test("archive conflict answered " + status + " is not a resolution: node and ancestor stay active", async () => {
	const { parent, child } = await conflicting();
	const archive = archiveThread(parent.id);
	await until(async () => (await getThread(child.id))!.blocked);
	report(child, child.sessionId, status, status + " unsure what to keep");
	const result = await archive;
	expect(result.closed).toEqual([]);
	expect(result.blocked).toMatchObject({ threadId: child.id, block: { action: "archive", files: ["conflict.txt"] } });
	expect(result.blocked!.block.reason).toContain("unresolved");
	expect((await getThread(child.id))).toMatchObject({ archived: false, blocked: { files: ["conflict.txt"] } });
	expect((await getThread(parent.id))!.archived).toBe(false);
	expect(existsSync(child.cwd) && existsSync(parent.cwd)).toBe(true);
});
