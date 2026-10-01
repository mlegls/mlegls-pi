import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";

export function git(cwd: string, ...args: string[]): string {
	return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trimEnd();
}

export function checkout(cwd: string): { cwd: string; project: string; worktree?: string; branch?: string } {
	cwd = realpathSync(cwd);
	const root = realpathSync(git(cwd, "rev-parse", "--show-toplevel"));
	const first = git(cwd, "worktree", "list", "--porcelain", "-z").split("\0")[0];
	if (!first?.startsWith("worktree ")) throw new Error("git worktree list: missing main checkout in " + cwd);
	const project = realpathSync(first.slice("worktree ".length));
	let branch: string | undefined;
	try { branch = git(cwd, "symbolic-ref", "--quiet", "--short", "HEAD"); }
	catch (error) { if ((error as { status?: number }).status !== 1) throw error; }
	return { cwd, project, worktree: root === project ? undefined : root, branch };
}
