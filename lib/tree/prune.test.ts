import { test, expect } from "bun:test";
import { execFileSync, spawn } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pruneWorktree } from "./actions";
import { unattachedWorktrees, type Workspace } from "./workspaces";

const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });

test("dashboard prune leaves dirty and busy worktrees alone, removes clean ones, keeps branches", () => {
	const dir = mkdtempSync(join(tmpdir(), "ab-prune-"));
	const root = join(dir, "repo"), path = join(dir, "wt");
	let sleeper: ReturnType<typeof spawn> | undefined;
	try {
		execFileSync("git", ["init", "-q", root]);
		git(root, "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-q", "--allow-empty", "-m", "init");
		git(root, "worktree", "add", "-q", "-b", "test-branch", path);
		const realRoot = realpathSync(root), realPath = realpathSync(path);
		const spaces = new Map([[realRoot, { key: realRoot, path: realRoot, main: true } as Workspace]]);
		expect(unattachedWorktrees(spaces)).toEqual([{ root: realRoot, path: realPath }]);
		writeFileSync(join(path, "untracked"), "hi");
		expect(pruneWorktree(realRoot, realPath)).toBe("dirty");
		unlinkSync(join(path, "untracked"));
		sleeper = spawn("sleep", ["20"], { cwd: path });
		expect(pruneWorktree(realRoot, realPath)).toBe("busy");
		sleeper.kill();
		sleeper = undefined;
		expect(pruneWorktree(realRoot, realPath)).toBe("removed");
		expect(git(root, "branch", "--list", "test-branch").trim()).toBe("test-branch");
		expect(unattachedWorktrees(spaces)).toEqual([]);
	} finally {
		sleeper?.kill();
		rmSync(dir, { recursive: true, force: true });
	}
});

test("prune ignores idle pane shells but protects their background jobs", () => {
	const dir = mkdtempSync(join(tmpdir(), "ab-prune-pane-"));
	const oldPath = process.env.PATH;
	try {
		const root = join(dir, "repo"), path = join(dir, "wt"), bin = join(dir, "bin");
		execFileSync("git", ["init", "-q", root]);
		git(root, "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-q", "--allow-empty", "-m", "init");
		git(root, "worktree", "add", "-q", "-b", "idle", path);
		mkdirSync(bin);
		const command = (name: string, output: string) => {
			writeFileSync(join(bin, name), `#!/bin/sh\ncat <<'DATA'\n${output}\nDATA\n`);
			chmodSync(join(bin, name), 0o755);
		};
		command("tmux", "123");
		command("lsof", `p123\nn${realpathSync(path)}`);
		command("ps", "123 1 /bin/zsh\n124 123 sleep");
		process.env.PATH = bin + ":" + oldPath;
		expect(pruneWorktree(root, path)).toBe("busy");
		command("ps", "123 1 /bin/zsh");
		const spaces = new Map([[root, { key: root, path: root, main: true } as Workspace]]);
		expect(unattachedWorktrees(spaces)).toEqual([{ root: realpathSync(root), path: realpathSync(path) }]);
		expect(pruneWorktree(root, path)).toBe("removed");
	} finally {
		process.env.PATH = oldPath;
		rmSync(dir, { recursive: true, force: true });
	}
});
