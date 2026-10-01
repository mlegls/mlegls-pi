import { expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { saveThread } from "../thread";
import { childSession } from "./jump";

let state: string, root: string, oldState: string | undefined;
beforeEach(() => {
	oldState = process.env.XDG_STATE_HOME;
	state = mkdtempSync(join(tmpdir(), "jump-state-")); process.env.XDG_STATE_HOME = state;
	root = mkdtempSync(join(tmpdir(), "jump-repo-"));
});
afterEach(() => {
	if (oldState === undefined) delete process.env.XDG_STATE_HOME; else process.env.XDG_STATE_HOME = oldState;
	rmSync(state, { recursive: true, force: true }); rmSync(root, { recursive: true, force: true });
});

// Replays wm-workers-over-threads drive check 2: /jump follows the registry's current canonical session.
test("jump resolves the registered worker's canonical session file; unknown handles are errors", async () => {
	const project = join(realpathSync(root), "main");
	execFileSync("git", ["init", "-q", "-b", "main", project]);
	execFileSync("git", ["-C", project, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "root"]);
	const id = randomUUID(), file = join(root, id + ".jsonl");
	await saveThread({ id, sessionId: id, sessionFile: file, cwd: project, project, worktree: project, ownership: "owner", branch: "main",
		worker: { run: "r", handle: "w" }, archived: false, created: new Date().toISOString() });
	expect(await childSession("w", project)).toBe(file);
	await expect(childSession("missing", project)).rejects.toThrow("no registered worker");
});
