// Shared channels a session joins by where it works, beside its own mailbox: its worktree
// (wt/<repo>/<branch>) and, when the branch or wm handle names a tracker issue, that ticket
// (ticket/<repo>/<slug>). An experiment: whether these ever beat messaging sessions directly
// is read off the board (`ab mail --stats`).
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

function git(cwd: string, ...args: string[]): string | undefined {
	try { return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
	catch { return undefined; }
}

export function scopes(cwd: string, env: NodeJS.ProcessEnv = process.env): string[] {
	const common = git(cwd, "rev-parse", "--git-common-dir");
	const top = git(cwd, "rev-parse", "--show-toplevel");
	if (!common || !top) return [];
	const repo = basename(dirname(resolve(cwd, common)));
	const branch = git(cwd, "symbolic-ref", "--short", "-q", "HEAD");
	const out: string[] = [];
	if (branch) out.push(`wt/${repo}/${branch}`);
	// A verifier works its implementer's ticket; branches may carry a run/ prefix.
	for (const name of [env.PI_WM_HANDLE, branch?.split("/").pop()]) {
		const slug = name?.replace(/-verify$/, "");
		if (slug && existsSync(join(top, "docs/issues", slug + ".md"))) { out.push(`ticket/${repo}/${slug}`); break; }
	}
	return out;
}
