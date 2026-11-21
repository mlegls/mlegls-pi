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

/** Sample current HEADs while workers own the paths, before handoff or cleanup can remove them. */
export async function captureWorkerForeignWork(context: { state: GlobalRunState; save: () => void }, groups: [string, Handle[]][]) {
	const roots = groups.flatMap(([slug, workers]) => workers.filter(w => existsSync(w.path))
		.map(w => ({ slug, worker: w.handle, root: realpathSync(w.path) })));
	if (!roots.length) return;
	const primary = commonDir(roots[0].root);
	const loaded = new Set<string>();
	for (const path of [...piPathPackages(), ...await bbPathPlugins()]) {
		const repo = commonDir(path);
		if (repo && repo !== primary) loaded.add(realpathSync(git(path, "rev-parse", "--show-toplevel")));
	}
	for (const checkout of loaded) {
		const repository = commonDir(checkout);
		for (const { path } of await worktrees(checkout)) {
			const owner = roots.find(({ root }) => {
				const child = relative(root, path);
				return child && !isAbsolute(child) && child !== ".." && !child.startsWith(".." + sep);
			});
			if (!owner || commonDir(path) !== repository) continue;
			let commit: string;
			try { commit = git(path, "rev-parse", "HEAD"); }
			catch (error) { if (!existsSync(path)) continue; throw error; }
			const { slug, worker } = owner, previous = context.state.foreignWork, receipts = previous?.[slug] ?? [];
			if (receipts.some(r => r.worker === worker && r.checkout === checkout && r.commit === commit) || isAncestor(checkout, commit)) continue;
			context.state.foreignWork = { ...previous, [slug]: [...receipts, { worker, checkout, commit }] };
			try { context.save(); }
			catch (error) { context.state.foreignWork = previous; throw error; }
		}
	}
}
