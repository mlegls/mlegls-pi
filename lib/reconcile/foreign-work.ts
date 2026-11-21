import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { expandCheckout } from "../commit-handoff.ts";
import type { Handle } from "../dispatch.ts";
import { bbPathPlugins } from "../thread/bb.ts";
import { commonDir } from "../thread/git.ts";
import { worktrees } from "../thread/lifecycle-git.ts";
import { git, isAncestor } from "./checks.ts";
import type { GlobalRunState } from "./tracker-state.ts";

export const piPackageSettings = () => join(process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi/agent"), "settings.json");

export function piPathPackages(settings = piPackageSettings()): string[] {
	const data = existsSync(settings) ? JSON.parse(readFileSync(settings, "utf8")) : {};
	return (Array.isArray(data.packages) ? data.packages : []).flatMap((entry: unknown) => {
		const source = typeof entry === "object" && entry ? (entry as { source?: unknown }).source : entry;
		return typeof source === "string" && !/^(npm:|git:|https?:|ssh:|git@)/.test(source)
			? [resolve(dirname(settings), expandCheckout(source))] : [];
	});
}

/** A registered worktree below a worker's checkout belongs to that worker.
 * Read its own HEAD reflog so merely checking out an existing branch doesn't
 * become an installation requirement. Save before retirement removes the path. */
export async function captureWorkerForeignWork(context: { state: GlobalRunState; save: () => void }, slug: string, workers: Handle[]) {
	const roots = workers.filter(w => existsSync(w.path)).map(w => realpathSync(w.path));
	if (!roots.length) return;
	const primary = commonDir(roots[0]);
	const loaded = new Set<string>();
	for (const path of [...piPathPackages(), ...await bbPathPlugins()]) {
		const repo = commonDir(path);
		if (repo && repo !== primary) loaded.add(realpathSync(git(path, "rev-parse", "--show-toplevel")));
	}
	const previous = context.state.foreignWork;
	const receipts = [...(previous?.[slug] ?? [])];
	for (const checkout of loaded) {
		const repository = commonDir(checkout);
		for (const { path } of await worktrees(checkout)) {
			const owned = roots.some(root => {
				const child = relative(root, path);
				return child && !isAbsolute(child) && child !== ".." && !child.startsWith(".." + sep);
			});
			if (!owned || commonDir(path) !== repository) continue;
			for (const line of git(path, "log", "-g", "--format=%H%x09%gs", "HEAD").split("\n")) {
				const [commit, subject] = line.split("\t", 2);
				if (!/^(commit(?: \([^)]+\))?:|cherry-pick:|revert:|merge .*: Merge made by|rebase \((?:pick|squash|fixup|continue)\):)/.test(subject ?? "")) continue;
				if (receipts.some(r => r.checkout === checkout && r.commit === commit)) continue;
				// Ignore abandoned or superseded commits, including the temporary heads of a rebase.
				if (!isAncestor(path, commit) && !git(path, "for-each-ref", "--count=1", "--contains=" + commit, "refs/heads/")) continue;
				receipts.push({ checkout, commit });
			}
		}
	}
	if (receipts.length === (previous?.[slug]?.length ?? 0)) return;
	context.state.foreignWork = { ...previous, [slug]: receipts };
	try { context.save(); }
	catch (error) { context.state.foreignWork = previous; throw error; }
}
