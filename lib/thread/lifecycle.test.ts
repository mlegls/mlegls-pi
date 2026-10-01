import { afterAll, beforeAll, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { send } from "../board/store";
import { ThreadMergeConflict, archiveThread, integrateThread } from "./lifecycle";
import { getThread, setCurrentSession } from "./registry";
import { newThread } from "./runtime";
import { terminals, zmx } from "./zmx";
import type { ThreadRecord } from "./types";

// Unit tests for the contract controls docs/attachments/thread-archive-and-abandon/drive.md leaves to review
// (C2 report identity/freshness, C6 raw destination/edge controls). Shell-fixture threads: no pi, no model.
const root = realpathSync(mkdtempSync("/tmp/ab-lifecycle-test-")); // short: zmx socket paths are length-limited
const saved = { ...process.env };
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
const repo = join(root, "repo");
const sleeper = { cmd: "sleep 300" };
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
	const parent = await newThread({ cwd: repo, worktree: name + "p", launch: sleeper });
	const child = await newThread({ cwd: parent.cwd, parent: parent.id, worktree: name + "c", launch: sleeper });
	commit(parent.cwd, "conflict.txt", "parent");
	commit(child.cwd, "conflict.txt", "child");
	return { parent, child };
}
const topic = (t: ThreadRecord) => "thread/" + t.id;
const report = (t: ThreadRecord, session: string, tag: string, body: string) =>
	send({ topic: topic(t), tags: [tag], from: { session, name: "test" }, body });

beforeAll(() => {
	for (const key of Object.keys(process.env)) if (/^(?:PI_WM_.*|PI_BOARD_.*|PI_SESSION_.*|AB_THREAD_ID|ZMX_.*|TMUX.*)$/.test(key)) delete process.env[key];
	Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"), PI_BOARD_DIR: join(root, "board"), PI_CODING_AGENT_DIR: join(root, "agent"), ZMX_DIR: join(root, "zmx"), MISE_TRUSTED_CONFIG_PATHS: root });
	mkdirSync(repo);
	git(repo, "init", "-b", "main");
	git(repo, "config", "user.name", "t");
	git(repo, "config", "user.email", "t@example.invalid");
	writeFileSync(join(repo, "conflict.txt"), "seed");
	git(repo, "add", ".");
	git(repo, "commit", "-m", "seed");
});

afterAll(async () => {
	for (const t of await terminals().catch(() => [])) await zmx(["kill", t.name, "--force"]).catch(() => {});
	process.env = saved;
	rmSync(root, { recursive: true, force: true });
});

test("raw integrate follows ab-parent, refuses dirty or unprepared trees, and leaves threads active", async () => {
	const name = fresh();
	const mid = await newThread({ cwd: repo, worktree: name + "m", launch: sleeper });
	const kid = await newThread({ cwd: mid.cwd, parent: mid.id, worktree: name + "k", launch: sleeper });
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

	const from = process.cwd(); // not any thread's checkout
	expect(from).not.toBe(repo);
	expect(await integrateThread(kid.id)).toEqual({ branch: kid.branch!, parentBranch: "main", path: repo, mode: "rebase" });
	expect(readFileSync(join(repo, name + ".txt"), "utf8")).toBe("kid");
	expect(git(mid.cwd, "branch", "--contains", git(kid.cwd, "rev-parse", "HEAD"))).not.toContain(mid.branch!);
	expect((await getThread(kid.id))!.archived).toBe(false);
	expect(existsSync(kid.cwd)).toBe(true);
});

test("raw integrate names a missing or deleted ab-parent instead of choosing another target", async () => {
	const name = fresh();
	const t = await newThread({ cwd: repo, worktree: name, launch: sleeper });
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
	const t = await newThread({ cwd: repo, worktree: name, launch: sleeper });
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
