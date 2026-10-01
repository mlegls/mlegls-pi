import { execFile } from "node:child_process";

export async function gitAttempt(cwd: string, ...args: string[]): Promise<{ code: number; out: string; err: string }> {
	return new Promise((resolve, reject) => {
		execFile("git", ["-C", cwd, ...args], { encoding: "utf8", maxBuffer: 64 << 20 }, (error, out, err) => {
			if (error && typeof error.code !== "number") { reject(error); return; }
			resolve({ code: typeof error?.code === "number" ? error.code : 0, out: out.trimEnd(), err: err.trimEnd() });
		});
	});
}

export async function gitChecked(cwd: string, ...args: string[]): Promise<string> {
	const result = await gitAttempt(cwd, ...args);
	if (result.code) throw new Error("git " + args.join(" ") + " in " + cwd + ": " + (result.err || result.out));
	return result.out;
}

export async function worktrees(project: string): Promise<{ path: string; branch?: string }[]> {
	const output = await gitChecked(project, "worktree", "list", "--porcelain", "-z");
	return output.split("\0\0").filter(Boolean).map(record => {
		const fields = record.split("\0");
		const path = fields.find(f => f.startsWith("worktree "))?.slice(9);
		if (!path) throw new Error("git worktree list: missing path in " + project);
		return { path, branch: fields.find(f => f.startsWith("branch refs/heads/"))?.slice(18) };
	});
}
