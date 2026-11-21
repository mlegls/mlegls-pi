import { accessSync, constants, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gitAttempt, gitChecked } from "./lifecycle-git";

export class CommitHookFailure extends Error {
	constructor(commit: string, hook: string, readonly status: number, readonly stdout: string, readonly stderr: string) {
		super("integrate: " + hook + " refused commit " + commit + " (exit " + status + "). Amend or rewrite that commit, then retry."
			+ [stdout, stderr].filter(Boolean).map(s => "\n" + s).join(""));
		this.name = "CommitHookFailure";
	}
}

function executable(path: string): boolean {
	try { accessSync(path, constants.X_OK); return true; }
	catch (error: any) {
		if (["ENOENT", "ENOTDIR", "EACCES"].includes(error.code)) return false;
		throw error;
	}
}

/** Use the destination's hook installation and the worker's prepared checkout (including dependencies).
 * Each hook sees the original parent as HEAD and the commit staged, as when committing. Nothing is
 * recommitted: post-commit side effects stay off and hook rewrites must be made in the actual branch. */
export async function checkCommitHooks(cwd: string, branch: string, destination: string, base: string): Promise<void> {
	const hooks = await gitChecked(destination, "rev-parse", "--path-format=absolute", "--git-path", "hooks");
	const names = ["pre-commit", "prepare-commit-msg", "commit-msg"].filter(name => executable(join(hooks, name)));
	if (!names.length) return;
	const commits = await gitChecked(cwd, "rev-list", "--reverse", "--topo-order", "--parents", base + "..HEAD");
	if (!commits) return;
	const scratch = mkdtempSync(join(await gitChecked(cwd, "rev-parse", "--absolute-git-dir"), "commit-hooks-"));
	const messageFile = join(scratch, "message");
	const checkout = (...args: string[]) => gitChecked(cwd, "-c", "core.hooksPath=/dev/null", "checkout", "--quiet", "--no-recurse-submodules", "--no-overwrite-ignore", ...args);
	let detached = false;
	try {
		for (const line of commits.split("\n")) {
			const [commit, parent] = line.split(" ");
			if (!parent) throw new Error("integrate: cannot replay hooks on unrelated root commit " + commit);
			await checkout("--detach", commit);
			detached = true;
			const tree = await gitChecked(cwd, "rev-parse", commit + "^{tree}");
			const message = (await gitChecked(cwd, "show", "-s", "--format=%B%x00", commit)).slice(0, -1);
			writeFileSync(messageFile, message);
			// Move only detached HEAD, leaving the checked-out commit staged against its parent.
			await gitChecked(cwd, "update-ref", "--no-deref", "HEAD", parent, commit);
			try {
				for (const name of names) {
					const args = name === "pre-commit" ? [] : name === "commit-msg" ? [messageFile] : [messageFile, "commit", commit];
					const hook = await gitAttempt(cwd, "-c", "core.hooksPath=" + hooks, "hook", "run", name, "--", ...args);
					if (hook.code) throw new CommitHookFailure(commit, name, hook.code, hook.out, hook.err);
					if (await gitChecked(cwd, "write-tree") !== tree)
						throw new CommitHookFailure(commit, name, 1, hook.out, [hook.err, "The hook rewrote staged files."].filter(Boolean).join("\n"));
					if (readFileSync(messageFile, "utf8") !== message)
						throw new CommitHookFailure(commit, name, 1, hook.out, [hook.err, "The hook rewrote the commit message."].filter(Boolean).join("\n"));
				}
			} finally {
				await gitChecked(cwd, "update-ref", "--no-deref", "HEAD", commit, parent);
				await gitChecked(cwd, "read-tree", "--reset", "-u", commit);
			}
		}
	} finally {
		try { if (detached) await checkout(branch); }
		finally { rmSync(scratch, { recursive: true, force: true }); }
	}
}
