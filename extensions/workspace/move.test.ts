import { afterEach, beforeEach, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { getThread, saveThread } from "../../lib/thread/registry";
import { switchWorkspace } from "./index";
import { moveRefusal, moveThread } from "./move";

let root: string, state: string | undefined;
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
beforeEach(() => {
	root = realpathSync(mkdtempSync(join(tmpdir(), "workspace-move-")));
	state = process.env.XDG_STATE_HOME;
	process.env.XDG_STATE_HOME = join(root, "state");
});
afterEach(() => {
	if (state === undefined) delete process.env.XDG_STATE_HOME; else process.env.XDG_STATE_HOME = state;
	rmSync(root, { recursive: true, force: true });
});

/** A thread owning worktree "w" of project "p" (merging into main), and a second project "q" to move to. */
async function fixture() {
	const project = join(root, "p"), worktree = join(root, "w"), other = join(root, "q");
	for (const repo of [project, other]) {
		mkdirSync(repo);
		git(repo, "init", "-q", "-b", "main");
		git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "init");
	}
	git(project, "worktree", "add", "-q", "-b", "w", worktree);
	git(project, "config", "branch.w.ab-parent", "main");
	writeFileSync(join(worktree, ".gitignore"), "");
	git(worktree, "add", ".gitignore");
	git(worktree, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "ignore");
	git(project, "merge", "-q", "--ff-only", "w");
	const sm = SessionManager.create(worktree, join(root, "sessions"));
	sm.appendMessage({ role: "user", content: "hello", timestamp: 1 });
	const file = sm.getSessionFile()!;
	writeFileSync(file, [sm.getHeader(), ...sm.getBranch()].map(e => JSON.stringify(e)).join("\n") + "\n");
	const thread = { id: sm.getSessionId(), sessionId: sm.getSessionId(), sessionFile: file, cwd: worktree, project, worktree, branch: "w", ownership: "owner" as const, archived: false, created: new Date().toISOString() };
	await saveThread(thread);
	return { project, worktree, other, sm, thread };
}

test("a thread moves with its pi and closes the merged worktree it owned", async () => {
	const f = await fixture();
	const notes: string[] = [];
	const ctx: any = {
		cwd: f.worktree, sessionManager: f.sm, waitForIdle: async () => {}, ui: { notify: (m: string) => notes.push(m) },
		switchSession: async (path: string, options: any) => {
			await options.withSession({ cwd: f.other, ui: ctx.ui });
			expect((await getThread(f.thread.id))!.sessionFile).toBe(path);
			return { cancelled: false };
		},
	};
	expect(await switchWorkspace(f.other, ctx, { events: { emit() {} } } as any)).toBeUndefined();
	const moved = (await getThread(f.thread.id))!;
	expect(moved).toMatchObject({ cwd: f.other, project: f.other, ownership: "guest", branch: "main", archived: false });
	expect(moved.worktree).toBeUndefined();
	expect(existsSync(f.worktree)).toBe(false);
	expect(git(f.project, "branch", "--list", "w")).toBe("");
	expect(notes.join("\n")).toContain("closed this thread's merged worktree");
});

test("only unmerged work in the owned worktree refuses a move", async () => {
	const f = await fixture();
	writeFileSync(join(f.worktree, "x"), "x");
	expect(moveRefusal(f.thread, f.other)).toContain("uncommitted changes");
	git(f.worktree, "add", "x");
	git(f.worktree, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "x");
	expect(moveRefusal(f.thread, f.other)).toContain("1 commit(s) on w not in main");
	expect(moveRefusal(f.thread, f.worktree)).toBeUndefined(); // staying inside it leaves nothing
	git(f.worktree, "reset", "-q", "--hard", "main");
	expect(moveRefusal(f.thread, f.other)).toBeUndefined();
});

test("a merged worktree another thread merges into is kept, and a non-git target is still a move", async () => {
	const f = await fixture();
	await saveThread({ ...f.thread, id: "child", sessionId: "child", cwd: join(root, "c"), branch: "c" });
	git(f.project, "config", "branch.c.ab-parent", "w");
	expect(await moveThread(f.thread.id, root, { id: "s2", file: join(root, "s2.jsonl") })).toContain("threads child work in it or merge into it");
	expect(existsSync(f.worktree)).toBe(true);
	expect(await getThread(f.thread.id)).toMatchObject({ cwd: root, project: root, ownership: "guest", sessionId: "s2" });
});
