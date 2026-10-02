// Shared channels a session joins by where it works, beside its own mailbox: its worktree
// (wt/<repo>/<branch>) and, when the branch or wm handle names a tracker issue, that ticket
// (ticket/<repo>/<slug>). An experiment: whether these ever beat messaging sessions directly
// is read off the board log.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

function git(cwd: string, ...args: string[]): string | undefined {
	try { return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
	catch { return undefined; }
}

/** The repository's name: its main checkout's directory, shared by every worktree. */
export function repoName(cwd: string): string | undefined {
	const common = git(cwd, "rev-parse", "--git-common-dir");
	return common ? basename(dirname(resolve(cwd, common))) : undefined;
}

/** A project's execution supervisor (the `tend` session), whichever session currently holds the role.
 * Mail here instead of a session id: a successor that subscribes receives what nobody acknowledged. */
export function supervisorTopic(cwd: string): string | undefined {
	const repo = repoName(cwd);
	return repo ? `role/${repo}/supervisor` : undefined;
}

export function scopes(cwd: string, env: NodeJS.ProcessEnv = process.env): string[] {
	const common = git(cwd, "rev-parse", "--git-common-dir");
	const top = git(cwd, "rev-parse", "--show-toplevel");
	if (!common || !top) return [];
	const repo = basename(dirname(resolve(cwd, common)));
	const branch = git(cwd, "symbolic-ref", "--short", "-q", "HEAD");
	const out: string[] = [];
	if (branch) out.push(`wt/${repo}/${branch}`);
	// A verifier or supervision phase works its implementer's ticket; branch names may
	// carry a run/ prefix. Prefer exact names before stripping phase suffixes.
	const candidate = branch?.split("/").pop();
	const phaseTicket = candidate?.replace(/-(?:implement|refine|drive|review|handler)-[0-9a-z]+$|-(?:drive|review)(?:-\d+)?$/, "");
	for (const name of [env.PI_WM_HANDLE, candidate, phaseTicket]) {
		const slug = name?.replace(/-verify$/, "");
		if (slug && existsSync(join(top, "docs/issues", slug + ".md"))) { out.push(`ticket/${repo}/${slug}`); break; }
	}
	return out;
}
