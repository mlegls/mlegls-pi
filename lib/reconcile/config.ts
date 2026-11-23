import { git } from "./checks.ts";

/** Read the owner's committed configuration, never dirty worktree contents. */
export function reconcileConfig(cwd: string): Record<string, unknown> {
	const file = git(cwd, "ls-tree", "HEAD", "--", ".pi/reconcile.json");
	if (!file) return {};
	let config: unknown;
	try { config = JSON.parse(git(cwd, "show", "HEAD:.pi/reconcile.json")); }
	catch { throw new Error("Malformed committed .pi/reconcile.json"); }
	if (!config || typeof config !== "object" || Array.isArray(config))
		throw new Error("Expected an object in committed .pi/reconcile.json");
	return config as Record<string, unknown>;
}

export function touchesRenderedSurface(cwd: string, base: string, head: string): boolean {
	const paths = reconcileConfig(cwd).renderedPaths;
	if (paths === undefined) return false;
	if (!Array.isArray(paths) || paths.some(p => typeof p !== "string" || !p.trim()))
		throw new Error("Expected renderedPaths to be an array of nonempty globs in committed .pi/reconcile.json");
	if (!paths.length) return false;
	const globs = paths.map(p => new Bun.Glob(p.includes("/") ? p : "**/" + p));
	// Include both names of a move across the surface boundary.
	return git(cwd, "diff", "--name-only", "--no-renames", "-z", base, head, "--").split("\0")
		.some(file => file && globs.some(glob => glob.match(file)));
}
